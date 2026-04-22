"""
DOCX Handler — Extract and reconstruct Word documents.
Preserves paragraphs, runs, tables, headers, footers, and all formatting.
"""

import io
from typing import List

from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_UNDERLINE

from app.models import Segment, SegmentMeta


def _extract_runs_from_paragraphs(
    paragraphs, location: str, segments: List[Segment], seg_id: int,
    table_idx=None, row_idx_override=None, col_idx_override=None,
) -> int:
    """Extract runs from a list of paragraphs, accumulating segments."""
    for para_idx, para in enumerate(paragraphs):
        for run_idx, run in enumerate(para.runs):
            text = run.text.strip()
            if not text:
                continue

            # Extract formatting
            font = run.font
            meta = SegmentMeta(
                type="docx_run",
                paragraph_idx=para_idx,
                run_idx=run_idx,
                bold=font.bold,
                italic=font.italic,
                underline=font.underline is not None and font.underline != WD_UNDERLINE.NONE if font.underline is not None else False,
                font_size=font.size.pt if font.size else None,
                font_name=font.name,
                font_color=(
                    str(font.color.rgb) if font.color and font.color.rgb else None
                ),
                location=location,
                table_idx=table_idx,
                row_idx=row_idx_override,
                col_idx=col_idx_override,
            )

            segments.append(Segment(id=seg_id, text=run.text, meta=meta))
            seg_id += 1

    return seg_id


def extract_docx(file_bytes: bytes) -> List[Segment]:
    """
    Extract all text runs from a DOCX file with formatting metadata.
    Handles body paragraphs, tables, headers, and footers.
    """
    doc = Document(io.BytesIO(file_bytes))
    segments: List[Segment] = []
    seg_id = 0

    # ── Body paragraphs ──
    seg_id = _extract_runs_from_paragraphs(
        doc.paragraphs, "body", segments, seg_id
    )

    # ── Tables ──
    for tbl_idx, table in enumerate(doc.tables):
        for r_idx, row in enumerate(table.rows):
            for c_idx, cell in enumerate(row.cells):
                seg_id = _extract_runs_from_paragraphs(
                    cell.paragraphs,
                    "table",
                    segments,
                    seg_id,
                    table_idx=tbl_idx,
                    row_idx_override=r_idx,
                    col_idx_override=c_idx,
                )

    # ── Headers and Footers ──
    for section in doc.sections:
        if section.header and section.header.paragraphs:
            seg_id = _extract_runs_from_paragraphs(
                section.header.paragraphs, "header", segments, seg_id
            )
        if section.footer and section.footer.paragraphs:
            seg_id = _extract_runs_from_paragraphs(
                section.footer.paragraphs, "footer", segments, seg_id
            )

    return segments


def reconstruct_docx(
    original_bytes: bytes, translated_segments: List[Segment]
) -> bytes:
    """
    Reconstruct a DOCX file with translated text while preserving all formatting.
    Maps segments back to their original runs by ID-based lookup.
    """
    doc = Document(io.BytesIO(original_bytes))

    # Build lookup: segment_id → translated text
    translation_map = {seg.id: seg.text for seg in translated_segments}

    # We need to walk the document in the same order as extraction
    # to match segment IDs correctly
    seg_id = 0

    # ── Body paragraphs ──
    for para in doc.paragraphs:
        for run in para.runs:
            text = run.text.strip()
            if not text:
                continue
            if seg_id in translation_map:
                # Preserve leading/trailing whitespace from original
                original = run.text
                leading = original[: len(original) - len(original.lstrip())]
                trailing = original[len(original.rstrip()) :]
                run.text = leading + translation_map[seg_id] + trailing
            seg_id += 1

    # ── Tables ──
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    for run in para.runs:
                        text = run.text.strip()
                        if not text:
                            continue
                        if seg_id in translation_map:
                            original = run.text
                            leading = original[: len(original) - len(original.lstrip())]
                            trailing = original[len(original.rstrip()) :]
                            run.text = leading + translation_map[seg_id] + trailing
                        seg_id += 1

    # ── Headers and Footers ──
    for section in doc.sections:
        if section.header and section.header.paragraphs:
            for para in section.header.paragraphs:
                for run in para.runs:
                    text = run.text.strip()
                    if not text:
                        continue
                    if seg_id in translation_map:
                        original = run.text
                        leading = original[: len(original) - len(original.lstrip())]
                        trailing = original[len(original.rstrip()) :]
                        run.text = leading + translation_map[seg_id] + trailing
                    seg_id += 1

        if section.footer and section.footer.paragraphs:
            for para in section.footer.paragraphs:
                for run in para.runs:
                    text = run.text.strip()
                    if not text:
                        continue
                    if seg_id in translation_map:
                        original = run.text
                        leading = original[: len(original) - len(original.lstrip())]
                        trailing = original[len(original.rstrip()) :]
                        run.text = leading + translation_map[seg_id] + trailing
                    seg_id += 1

    # Write to bytes
    output = io.BytesIO()
    doc.save(output)
    output.seek(0)
    return output.read()
