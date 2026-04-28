"""Translation endpoints — batch and streaming (SSE)."""

import asyncio
import base64
import json
import logging
import threading
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse

from app.services.file_service import (
    content_type, extract_file, output_filename, reconstruct_file, validate_file,
)
from app.translator import translate_segments

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1")


@router.post("/translate")
async def translate(
    file: UploadFile = File(...),
    sourceLang: str = Form(default="en"),
    targetLang: str = Form(...),
):
    filename = file.filename or "upload"
    file_bytes = await file.read()
    ext = validate_file(filename, file_bytes, sourceLang, targetLang)

    logger.info("Translate: %s (%d bytes) %s→%s", filename, len(file_bytes), sourceLang, targetLang)
    t0 = time.monotonic()

    try:
        segments, _ = await asyncio.get_event_loop().run_in_executor(
            None, extract_file, file_bytes, filename, ext
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Extraction failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Extraction failed: {e}")

    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, translate_segments, segments, sourceLang, targetLang
        )
    except Exception as e:
        logger.error("Translation failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Translation failed: {e}")

    try:
        out_bytes = await asyncio.get_event_loop().run_in_executor(
            None, reconstruct_file, file_bytes, result.segments, filename, ext
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Reconstruction failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Reconstruction failed: {e}")

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    out_name = output_filename(filename, ext)
    logger.info("Done in %dms: %d segs, %d hits, %d calls",
                elapsed_ms, len(segments), result.cache_hits, result.api_calls)

    return Response(
        content=out_bytes,
        media_type=content_type(ext),
        headers={
            "Content-Disposition":  f'attachment; filename="{out_name}"',
            "X-Segments-Count":     str(len(segments)),
            "X-Cache-Hits":         str(result.cache_hits),
            "X-Api-Calls":          str(result.api_calls),
            "X-Processing-Time-Ms": str(elapsed_ms),
        },
    )


@router.post("/translate/stream")
async def translate_stream(
    file: UploadFile = File(...),
    sourceLang: str = Form(default="en"),
    targetLang: str = Form(...),
):
    filename = file.filename or "upload"
    file_bytes = await file.read()
    ext = validate_file(filename, file_bytes, sourceLang, targetLang)

    try:
        segments, _ = await asyncio.get_event_loop().run_in_executor(
            None, extract_file, file_bytes, filename, ext
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
                    queue.put_nowait,
                    {"type": "segment", "current": current, "total": _total},
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
                    out_bytes = reconstruct_file(file_bytes, result.segments, filename, ext)
                    elapsed_ms = int((time.monotonic() - t0) * 1000)
                    out_name = output_filename(filename, ext)
                    orig_text = {s.id: s.text for s in segments}
                    diffs = [
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
                        "filename": out_name,
                        "file": base64.b64encode(out_bytes).decode(),
                        "mediaType": content_type(ext),
                        "segmentCount": total,
                        "cacheHits": result.cache_hits,
                        "apiCalls": result.api_calls,
                        "processingTimeMs": elapsed_ms,
                        "segments": diffs,
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
