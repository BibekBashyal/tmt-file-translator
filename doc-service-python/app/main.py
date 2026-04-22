"""
TMT Document Service — FastAPI Application

Stateless microservice for document parsing and reconstruction.
Two core endpoints: /extract and /reconstruct
"""

import io
import json
import logging
from typing import List

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.models import Segment, ExtractResponse
from app.handlers.csv_handler import extract_csv, reconstruct_csv
from app.handlers.docx_handler import extract_docx, reconstruct_docx
from app.handlers.pdf_handler import extract_pdf, reconstruct_pdf

# ── Logging ──
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App ──
app = FastAPI(
    title="TMT Document Service",
    description="Stateless document parsing and reconstruction service for the TMT File Translator",
    version="1.0.0",
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Supported file types ──
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".csv", ".tsv"}
MAX_FILE_SIZE = 1 * 1024 * 1024  # 1MB


def _get_extension(filename: str) -> str:
    """Extract lowercase file extension."""
    if "." in filename:
        return "." + filename.rsplit(".", 1)[1].lower()
    return ""


# ── Health Check ──
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "doc-service"}


# ── Extract Endpoint ──
@app.post("/extract", response_model=ExtractResponse)
async def extract(file: UploadFile = File(...)):
    """
    Parse a document and return text segments with positional/style metadata.
    
    Supported formats: .pdf, .docx, .csv, .tsv
    Max file size: 1MB
    """
    # Validate extension
    ext = _get_extension(file.filename or "")
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Supported: {', '.join(SUPPORTED_EXTENSIONS)}",
        )

    # Read and validate size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(file_bytes)} bytes). Max: {MAX_FILE_SIZE} bytes (1MB)",
        )

    logger.info(f"Extracting from {file.filename} ({len(file_bytes)} bytes, type: {ext})")

    try:
        if ext == ".pdf":
            segments = extract_pdf(file_bytes)
            file_type = "pdf"
        elif ext == ".docx":
            segments = extract_docx(file_bytes)
            file_type = "docx"
        elif ext in (".csv", ".tsv"):
            segments = extract_csv(file_bytes, file.filename or "file.csv")
            file_type = "csv" if ext == ".csv" else "tsv"
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported: {ext}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Extraction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

    logger.info(f"Extracted {len(segments)} segments from {file.filename}")

    return ExtractResponse(
        segments=segments,
        file_type=file_type,
        segment_count=len(segments),
    )


# ── Reconstruct Endpoint ──
@app.post("/reconstruct")
async def reconstruct(
    file: UploadFile = File(...),
    segments: str = Form(...),
):
    """
    Reconstruct a document with translated text segments.
    
    Accepts the original file and a JSON array of translated segments.
    Returns the reconstructed file as downloadable bytes.
    """
    # Validate extension
    ext = _get_extension(file.filename or "")
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}",
        )

    # Read original file
    file_bytes = await file.read()

    # Parse segments JSON
    try:
        segments_data = json.loads(segments)
        translated_segments = [Segment(**s) for s in segments_data]
    except (json.JSONDecodeError, Exception) as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid segments JSON: {str(e)}",
        )

    logger.info(
        f"Reconstructing {file.filename} with {len(translated_segments)} translated segments"
    )

    try:
        if ext == ".pdf":
            result_bytes = reconstruct_pdf(file_bytes, translated_segments)
            media_type = "application/pdf"
        elif ext == ".docx":
            result_bytes = reconstruct_docx(file_bytes, translated_segments)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif ext in (".csv", ".tsv"):
            result_bytes = reconstruct_csv(
                file_bytes, translated_segments, file.filename or "file.csv"
            )
            media_type = "text/csv" if ext == ".csv" else "text/tab-separated-values"
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported: {ext}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reconstruction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Reconstruction failed: {str(e)}")

    # Build output filename
    original_name = file.filename or f"translated{ext}"
    name_without_ext = original_name.rsplit(".", 1)[0]
    output_filename = f"{name_without_ext}_translated{ext}"

    logger.info(f"Reconstruction complete: {output_filename}")

    return Response(
        content=result_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{output_filename}"',
        },
    )
