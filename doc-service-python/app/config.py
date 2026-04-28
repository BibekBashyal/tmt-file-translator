"""Shared backend constants — file size limits, MIME types, header names."""

from typing import Dict, FrozenSet

SUPPORTED_EXTENSIONS: FrozenSet[str] = frozenset({".pdf", ".docx", ".csv", ".tsv"})
MAX_FILE_SIZE: int = 1 * 1024 * 1024  # 1 MB

CONTENT_TYPES: Dict[str, str] = {
    ".pdf":  "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".csv":  "text/csv",
    ".tsv":  "text/tab-separated-values",
}

EXPOSE_HEADERS = [
    "X-Segments-Count", "X-Cache-Hits", "X-Api-Calls",
    "X-Processing-Time-Ms", "Content-Disposition",
]
