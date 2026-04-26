"""
CSV/TSV Handler — Extract and reconstruct delimited text files.
"""

import csv
import io
from typing import List

from app.models import Segment, SegmentMeta


def detect_delimiter(filename: str) -> str:
    """Detect delimiter from file extension."""
    if filename.lower().endswith(".tsv"):
        return "\t"
    return ","


def extract_csv(file_bytes: bytes, filename: str) -> List[Segment]:
    """
    Extract all cells from a CSV/TSV file as translatable segments.
    Each non-empty cell becomes one segment with row/col metadata.
    """
    delimiter = detect_delimiter(filename)
    text = file_bytes.decode("utf-8-sig")  # handle BOM
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)

    segments: List[Segment] = []
    seg_id = 0

    for row_idx, row in enumerate(reader):
        for col_idx, cell in enumerate(row):
            cell_text = cell.strip()
            if not cell_text:
                continue

            segments.append(
                Segment(
                    id=seg_id,
                    text=cell_text,
                    meta=SegmentMeta(
                        type="csv_cell",
                        row=row_idx,
                        col=col_idx,
                        delimiter=delimiter,
                    ),
                )
            )
            seg_id += 1

    return segments


def reconstruct_csv(
    original_bytes: bytes,
    translated_segments: List[Segment],
    filename: str,
) -> bytes:
    """
    Reconstruct a CSV/TSV file with translated text.
    Preserves the original grid structure and delimiter.
    """
    delimiter = detect_delimiter(filename)
    text = original_bytes.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)

    # Read original grid
    original_rows = list(reader)

    # Build lookup: (row, col) → translated text
    translation_map = {}
    for seg in translated_segments:
        r = seg.meta.row
        c = seg.meta.col
        if r is not None and c is not None:
            translation_map[(r, c)] = seg.text

    # Reconstruct grid with translations
    for row_idx, row in enumerate(original_rows):
        for col_idx in range(len(row)):
            key = (row_idx, col_idx)
            if key in translation_map:
                original_rows[row_idx][col_idx] = translation_map[key]

    # Write back
    output = io.StringIO()
    writer = csv.writer(output, delimiter=delimiter, lineterminator="\n")
    writer.writerows(original_rows)

    # utf-8-sig writes the UTF-8 BOM so Excel opens with correct encoding
    return output.getvalue().encode("utf-8-sig")
