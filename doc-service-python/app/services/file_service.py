"""File validation, extraction, and reconstruction helpers."""

from typing import List, Tuple

from fastapi import HTTPException

from app.config import CONTENT_TYPES, MAX_FILE_SIZE, SUPPORTED_EXTENSIONS
from app.handlers.csv_handler import extract_csv, reconstruct_csv
from app.handlers.docx_handler import extract_docx, reconstruct_docx
from app.handlers.pdf_handler import extract_pdf, reconstruct_pdf
from app.models import Segment


def ext_of(filename: str) -> str:
    return ("." + filename.rsplit(".", 1)[1].lower()) if "." in filename else ""


def validate_file(filename: str, file_bytes: bytes, src_lang: str, tgt_lang: str) -> str:
    ext = ext_of(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}")
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large ({len(file_bytes)} bytes). Max: 1MB")
    if src_lang == tgt_lang:
        raise HTTPException(400, "Source and target language must be different")
    return ext


def extract_file(file_bytes: bytes, filename: str, ext: str) -> Tuple[List[Segment], str]:
    if ext == ".pdf":
        return extract_pdf(file_bytes), "pdf"
    if ext == ".docx":
        return extract_docx(file_bytes), "docx"
    if ext in (".csv", ".tsv"):
        return extract_csv(file_bytes, filename), ("csv" if ext == ".csv" else "tsv")
    raise HTTPException(400, f"Unsupported: {ext}")


def reconstruct_file(
    file_bytes: bytes, segments: List[Segment], filename: str, ext: str
) -> bytes:
    if ext == ".pdf":
        return reconstruct_pdf(file_bytes, segments)
    if ext == ".docx":
        return reconstruct_docx(file_bytes, segments)
    if ext in (".csv", ".tsv"):
        return reconstruct_csv(file_bytes, segments, filename)
    raise HTTPException(400, f"Unsupported: {ext}")


def output_filename(filename: str, ext: str) -> str:
    stem = filename.rsplit(".", 1)[0]
    return f"{stem}_translated{ext}"


def content_type(ext: str) -> str:
    return CONTENT_TYPES.get(ext, "application/octet-stream")
