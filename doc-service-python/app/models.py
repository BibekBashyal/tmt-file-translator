"""
Pydantic models for document segments and metadata.
Shared across all file handlers (PDF, DOCX, CSV/TSV).
"""

from typing import List, Optional
from pydantic import BaseModel


class SegmentMeta(BaseModel):
    """Metadata describing position, style, and source location of a text segment."""

    # Segment source type
    type: str  # "pdf_span", "docx_run", "csv_cell"

    # ── PDF-specific ──
    page: Optional[int] = None
    bbox: Optional[List[float]] = None          # [x0, y0, x1, y1]
    fontSize: Optional[float] = None
    fontName: Optional[str] = None
    color: Optional[int] = None
    flags: Optional[int] = None                  # bold/italic encoded in bits
    blockBbox: Optional[List[float]] = None      # parent block bounding box

    # ── DOCX-specific ──
    paragraph_idx: Optional[int] = None
    run_idx: Optional[int] = None
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    underline: Optional[bool] = None
    font_size: Optional[float] = None
    font_name: Optional[str] = None
    font_color: Optional[str] = None
    location: Optional[str] = None               # "body", "header", "footer"
    table_idx: Optional[int] = None
    row_idx: Optional[int] = None
    col_idx: Optional[int] = None

    # ── CSV/TSV-specific ──
    row: Optional[int] = None
    col: Optional[int] = None
    delimiter: Optional[str] = None


class Segment(BaseModel):
    """A single extractable/translatable text segment with metadata."""
    id: int
    text: str
    meta: SegmentMeta


class ExtractResponse(BaseModel):
    """Response from the /extract endpoint."""
    segments: List[Segment]
    file_type: str
    segment_count: int


class ReconstructRequest(BaseModel):
    """Request body for the /reconstruct endpoint (segments part)."""
    segments: List[Segment]
