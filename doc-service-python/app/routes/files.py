"""File extract and reconstruct endpoints."""

import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.config import MAX_FILE_SIZE, SUPPORTED_EXTENSIONS
from app.models import ExtractResponse, Segment
from app.services.file_service import (
    content_type, ext_of, extract_file, output_filename, reconstruct_file,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/extract", response_model=ExtractResponse)
async def extract(file: UploadFile = File(...)):
    ext = ext_of(file.filename or "")
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large: {len(file_bytes)} bytes")

    try:
        segments, file_type = extract_file(file_bytes, file.filename or "", ext)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Extraction failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Extraction failed: {e}")

    return ExtractResponse(segments=segments, file_type=file_type, segment_count=len(segments))


@router.post("/reconstruct")
async def reconstruct(
    file: UploadFile = File(...),
    segments: str = Form(...),
):
    ext = ext_of(file.filename or "")
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    file_bytes = await file.read()

    try:
        segments_data = json.loads(segments)
        translated_segments = [Segment(**s) for s in segments_data]
    except Exception as e:
        raise HTTPException(400, f"Invalid segments JSON: {e}")

    try:
        result_bytes = reconstruct_file(file_bytes, translated_segments, file.filename or "", ext)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Reconstruction failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Reconstruction failed: {e}")

    out_name = output_filename(file.filename or "file", ext)
    return Response(
        content=result_bytes,
        media_type=content_type(ext),
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
    )
