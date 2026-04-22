"""
PDF Handler — Extract and reconstruct PDF documents.
Preserves layout, positions, fonts, and styling.
Uses PyMuPDF (fitz) with Noto Sans Devanagari for Nepali/Tamang output.
"""

import os
from typing import List

import fitz  # PyMuPDF

from app.models import Segment, SegmentMeta

# Path to bundled Devanagari font
FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "fonts")
DEVANAGARI_FONT_PATH = os.path.join(FONT_DIR, "NotoSansDevanagari-Regular.ttf")


def extract_pdf(file_bytes: bytes) -> List[Segment]:
    """
    Extract text spans from a PDF with full positional and style metadata.
    Uses page.get_text("dict") for granular span-level extraction.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    segments: List[Segment] = []
    seg_id = 0

    for page_num in range(len(doc)):
        page = doc[page_num]
        page_dict = page.get_text("dict")

        for block in page_dict.get("blocks", []):
            # Skip image blocks
            if block.get("type") != 0:
                continue

            block_bbox = block.get("bbox", [0, 0, 0, 0])

            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if not text:
                        continue

                    segments.append(
                        Segment(
                            id=seg_id,
                            text=span["text"],
                            meta=SegmentMeta(
                                type="pdf_span",
                                page=page_num,
                                bbox=list(span.get("bbox", [0, 0, 0, 0])),
                                fontSize=span.get("size", 12.0),
                                fontName=span.get("font", ""),
                                color=span.get("color", 0),
                                flags=span.get("flags", 0),
                                blockBbox=list(block_bbox),
                            ),
                        )
                    )
                    seg_id += 1

    doc.close()
    return segments


def _needs_devanagari(text: str) -> bool:
    """Check if text contains Devanagari characters (Nepali/Tamang)."""
    for ch in text:
        if "\u0900" <= ch <= "\u097F":  # Devanagari Unicode block
            return True
    return False


def _fit_font_size(
    page: fitz.Page,
    rect: fitz.Rect,
    text: str,
    fontname: str,
    fontfile: str | None,
    max_size: float,
) -> float:
    """
    Try decreasing font sizes until text fits in the bounding box.
    Returns the best-fit font size.
    """
    for scale in [1.0, 0.85, 0.7, 0.6, 0.5]:
        size = max_size * scale
        rc = page.insert_textbox(
            rect,
            text,
            fontsize=size,
            fontname=fontname,
            fontfile=fontfile,
            overlay=True,
        )
        if rc >= 0:  # rc >= 0 means text fit
            return size
    return max_size * 0.5  # fallback to smallest


def reconstruct_pdf(
    original_bytes: bytes, translated_segments: List[Segment]
) -> bytes:
    """
    Reconstruct a PDF with translated text at original positions.
    
    Strategy:
    1. Group segments by page
    2. For each page: redact original text areas, then insert translated text
    3. Use Noto Sans Devanagari font for Devanagari text
    4. Dynamic font scaling to fit translated text in original bounding boxes
    """
    doc = fitz.open(stream=original_bytes, filetype="pdf")

    # Group segments by page
    pages_segments: dict[int, List[Segment]] = {}
    for seg in translated_segments:
        page_num = seg.meta.page
        if page_num is not None:
            pages_segments.setdefault(page_num, []).append(seg)

    for page_num, segs in pages_segments.items():
        if page_num >= len(doc):
            continue

        page = doc[page_num]

        # Phase 1: Redact all original text areas
        for seg in segs:
            if seg.meta.bbox:
                bbox = seg.meta.bbox
                rect = fitz.Rect(bbox[0], bbox[1], bbox[2], bbox[3])
                page.add_redact_annot(rect)

        # Apply all redactions at once (removes original text)
        page.apply_redactions()

        # Phase 2: Insert translated text
        for seg in segs:
            if not seg.meta.bbox:
                continue

            bbox = seg.meta.bbox
            rect = fitz.Rect(bbox[0], bbox[1], bbox[2], bbox[3])

            text = seg.text
            font_size = seg.meta.fontSize or 12.0
            color_int = seg.meta.color or 0

            # Convert integer color to RGB tuple (0-1 range)
            r = ((color_int >> 16) & 0xFF) / 255.0
            g = ((color_int >> 8) & 0xFF) / 255.0
            b = (color_int & 0xFF) / 255.0

            # Determine font
            use_devanagari = _needs_devanagari(text)
            if use_devanagari and os.path.exists(DEVANAGARI_FONT_PATH):
                fontname = "NotoDevanagari"
                fontfile = DEVANAGARI_FONT_PATH
            else:
                fontname = "helv"  # Helvetica fallback
                fontfile = None

            # Try to fit text, scaling down if needed
            # First attempt with original size
            rc = page.insert_textbox(
                rect,
                text,
                fontsize=font_size,
                fontname=fontname,
                fontfile=fontfile,
                color=(r, g, b),
                overlay=True,
            )

            # If text didn't fit (rc < 0), try smaller sizes
            if rc < 0:
                # Remove what we just inserted by redacting and re-inserting
                for scale in [0.85, 0.7, 0.6, 0.5]:
                    scaled_size = font_size * scale
                    rc = page.insert_textbox(
                        rect,
                        text,
                        fontsize=scaled_size,
                        fontname=fontname,
                        fontfile=fontfile,
                        color=(r, g, b),
                        overlay=True,
                    )
                    if rc >= 0:
                        break

    result = doc.tobytes()
    doc.close()
    return result
