"""
TMT Document Service — FastAPI Application
"""

import asyncio
import base64
import json
import logging
import threading
import time
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from app.models import Segment, ExtractResponse
from app.handlers.csv_handler import extract_csv, reconstruct_csv
from app.handlers.docx_handler import extract_docx, reconstruct_docx
from app.handlers.pdf_handler import extract_pdf, reconstruct_pdf
from app.translator import translate_segments, load_cache
from app import tmt_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".csv", ".tsv"}
MAX_FILE_SIZE = 1 * 1024 * 1024  # 1MB

CONTENT_TYPES = {
    ".pdf":  "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".csv":  "text/csv",
    ".tsv":  "text/tab-separated-values",
}

EXPOSE_HEADERS = [
    "X-Segments-Count", "X-Cache-Hits", "X-Api-Calls",
    "X-Processing-Time-Ms", "Content-Disposition",
]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Run blocking calibration in a thread so the event loop isn't blocked
    await asyncio.get_event_loop().run_in_executor(None, load_cache)
    await asyncio.get_event_loop().run_in_executor(None, tmt_client.calibrate)
    yield


app = FastAPI(
    title="TMT Translation Service",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=EXPOSE_HEADERS,
)


def _ext(filename: str) -> str:
    return ("." + filename.rsplit(".", 1)[1].lower()) if "." in filename else ""


def _extract(file_bytes: bytes, filename: str, ext: str) -> tuple[List[Segment], str]:
    if ext == ".pdf":
        return extract_pdf(file_bytes), "pdf"
    if ext == ".docx":
        return extract_docx(file_bytes), "docx"
    if ext in (".csv", ".tsv"):
        return extract_csv(file_bytes, filename), "csv" if ext == ".csv" else "tsv"
    raise HTTPException(status_code=400, detail=f"Unsupported: {ext}")


def _reconstruct(file_bytes: bytes, segments: List[Segment], filename: str, ext: str) -> bytes:
    if ext == ".pdf":
        return reconstruct_pdf(file_bytes, segments)
    if ext == ".docx":
        return reconstruct_docx(file_bytes, segments)
    if ext in (".csv", ".tsv"):
        return reconstruct_csv(file_bytes, segments, filename)
    raise HTTPException(status_code=400, detail=f"Unsupported: {ext}")


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "doc-service"}


# ── Translate (full pipeline) ─────────────────────────────────────────────────

@app.post("/api/v1/translate")
async def translate(
    file: UploadFile = File(...),
    sourceLang: str = Form(default="en"),
    targetLang: str = Form(...),
):
    filename = file.filename or "upload"
    ext = _ext(filename)

    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large ({len(file_bytes)} bytes). Max: 1MB")

    if sourceLang == targetLang:
        raise HTTPException(400, "Source and target language must be different")

    logger.info("Translate request: %s (%d bytes) %s→%s",
                filename, len(file_bytes), sourceLang, targetLang)

    t0 = time.monotonic()

    try:
        segments, _ = await asyncio.get_event_loop().run_in_executor(
            None, _extract, file_bytes, filename, ext
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Extraction failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Extraction failed: {e}")

    logger.info("Extracted %d segments", len(segments))

    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, translate_segments, segments, sourceLang, targetLang
        )
    except Exception as e:
        logger.error("Translation failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Translation failed: {e}")

    try:
        output_bytes = await asyncio.get_event_loop().run_in_executor(
            None, _reconstruct, file_bytes, result.segments, filename, ext
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Reconstruction failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Reconstruction failed: {e}")

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    name_stem = filename.rsplit(".", 1)[0]
    output_filename = f"{name_stem}_translated{ext}"

    logger.info("Done in %dms: %d segments, %d cache hits, %d API calls",
                elapsed_ms, len(segments), result.cache_hits, result.api_calls)

    return Response(
        content=output_bytes,
        media_type=CONTENT_TYPES.get(ext, "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{output_filename}"',
            "X-Segments-Count":     str(len(segments)),
            "X-Cache-Hits":         str(result.cache_hits),
            "X-Api-Calls":          str(result.api_calls),
            "X-Processing-Time-Ms": str(elapsed_ms),
        },
    )


# ── Translate stream (SSE) ───────────────────────────────────────────────────

@app.post("/api/v1/translate/stream")
async def translate_stream(
    file: UploadFile = File(...),
    sourceLang: str = Form(default="en"),
    targetLang: str = Form(...),
):
    filename = file.filename or "upload"
    ext = _ext(filename)

    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large ({len(file_bytes)} bytes). Max: 1MB")

    if sourceLang == targetLang:
        raise HTTPException(400, "Source and target language must be different")

    try:
        segments, _ = await asyncio.get_event_loop().run_in_executor(
            None, _extract, file_bytes, filename, ext
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Extraction failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Extraction failed: {e}")

    total = len(segments)
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()
    cancel_event = threading.Event()

    async def generate():
        try:
            yield f"data: {json.dumps({'type': 'extracted', 'total': total})}\n\n"

            t0 = time.monotonic()

            def on_progress(current: int, _total: int) -> None:
                loop.call_soon_threadsafe(
                    queue.put_nowait, {"type": "segment", "current": current, "total": _total}
                )

            def on_backoff(seconds: float) -> None:
                loop.call_soon_threadsafe(
                    queue.put_nowait, {"type": "backoff", "seconds": int(seconds)}
                )

            def run_translation() -> None:
                try:
                    result = translate_segments(
                        segments, sourceLang, targetLang, on_progress, on_backoff, cancel_event
                    )
                    output_bytes = _reconstruct(file_bytes, result.segments, filename, ext)
                    elapsed_ms = int((time.monotonic() - t0) * 1000)
                    name_stem = filename.rsplit(".", 1)[0]
                    output_filename = f"{name_stem}_translated{ext}"
                    orig_text = {s.id: s.text for s in segments}
                    segment_diffs = [
                        {
                            "id": s.id,
                            "original": orig_text[s.id],
                            "translated": s.text,
                            "meta": s.meta.model_dump(exclude_none=True),
                        }
                        for s in result.segments
                    ]
                    loop.call_soon_threadsafe(queue.put_nowait, {
                        "type": "done",
                        "filename": output_filename,
                        "file": base64.b64encode(output_bytes).decode(),
                        "mediaType": CONTENT_TYPES.get(ext, "application/octet-stream"),
                        "segmentCount": total,
                        "cacheHits": result.cache_hits,
                        "apiCalls": result.api_calls,
                        "processingTimeMs": elapsed_ms,
                        "segments": segment_diffs,
                    })
                except InterruptedError:
                    logger.info("Translation cancelled by client")
                except Exception as e:
                    logger.error("Stream translation failed: %s", e, exc_info=True)
                    loop.call_soon_threadsafe(
                        queue.put_nowait, {"type": "error", "message": str(e)}
                    )

            fut = loop.run_in_executor(None, run_translation)

            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                if event["type"] in ("done", "error"):
                    break

            await fut

        except GeneratorExit:
            cancel_event.set()
            logger.info("Client disconnected — translation cancelled")

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Extract (internal / legacy) ───────────────────────────────────────────────

@app.post("/extract", response_model=ExtractResponse)
async def extract(file: UploadFile = File(...)):
    ext = _ext(file.filename or "")
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large: {len(file_bytes)} bytes")

    try:
        segments, file_type = _extract(file_bytes, file.filename or "", ext)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Extraction failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Extraction failed: {e}")

    return ExtractResponse(segments=segments, file_type=file_type, segment_count=len(segments))


# ── Reconstruct (internal / legacy) ──────────────────────────────────────────

@app.post("/reconstruct")
async def reconstruct(
    file: UploadFile = File(...),
    segments: str = Form(...),
):
    ext = _ext(file.filename or "")
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    file_bytes = await file.read()

    try:
        segments_data = json.loads(segments)
        translated_segments = [Segment(**s) for s in segments_data]
    except Exception as e:
        raise HTTPException(400, f"Invalid segments JSON: {e}")

    try:
        result_bytes = _reconstruct(file_bytes, translated_segments, file.filename or "", ext)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Reconstruction failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Reconstruction failed: {e}")

    name_stem = (file.filename or "file").rsplit(".", 1)[0]
    output_filename = f"{name_stem}_translated{ext}"

    return Response(
        content=result_bytes,
        media_type=CONTENT_TYPES.get(ext, "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{output_filename}"'},
    )
