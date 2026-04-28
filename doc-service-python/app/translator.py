"""
Translation orchestration — cache, deduplication, sequential API calls.
Cache is persisted to disk so warm runs skip API calls entirely.
"""

import json
import logging
import threading
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, Optional

from app.models import Segment
from app.tmt_client import client

logger = logging.getLogger(__name__)

_CACHE_FILE = Path(".tmt-cache.json")
_MAX_CACHE_SIZE = 50_000

# In-memory LRU cache: oldest entry at the left, newest at the right.
_cache: OrderedDict[str, str] = OrderedDict()


def load_cache() -> None:
    """Load persisted cache from disk on startup, capping at _MAX_CACHE_SIZE newest entries."""
    if _CACHE_FILE.exists():
        try:
            data: Dict[str, str] = json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
            # File is written oldest-first, so take the tail to keep the newest entries.
            entries = list(data.items())
            if len(entries) > _MAX_CACHE_SIZE:
                dropped = len(entries) - _MAX_CACHE_SIZE
                entries = entries[-_MAX_CACHE_SIZE:]
                logger.warning("Cache file exceeded limit — dropped %d oldest entries on load", dropped)
            _cache.update(entries)
            logger.info("Loaded %d cached translations from %s", len(_cache), _CACHE_FILE)
        except Exception as e:
            logger.warning("Could not load cache file: %s", e)


def _persist(key: str, value: str) -> None:
    """Add or refresh an entry, evict the LRU entry if over the size cap, then flush to disk."""
    if key in _cache:
        _cache.move_to_end(key)
    _cache[key] = value
    if len(_cache) > _MAX_CACHE_SIZE:
        evicted_key, _ = _cache.popitem(last=False)
        logger.debug("Cache full — evicted LRU entry (key prefix: %s…)", evicted_key[:40])
    try:
        _CACHE_FILE.write_text(
            json.dumps(dict(_cache), ensure_ascii=False, indent=None),
            encoding="utf-8",
        )
    except Exception as e:
        logger.warning("Could not persist cache: %s", e)


@dataclass
class TranslationResult:
    segments: List[Segment]
    cache_hits: int
    api_calls: int


def _key(text: str, src: str, tgt: str) -> str:
    return f"{src}\0{tgt}\0{text}"


def translate_segments(
    segments: List[Segment], src_lang: str, tgt_lang: str,
    on_progress: Optional[Callable[[int, int], None]] = None,
    on_backoff: Optional[Callable[[float], None]] = None,
    cancel_event: Optional[threading.Event] = None,
) -> TranslationResult:
    if not segments:
        return TranslationResult(segments=[], cache_hits=0, api_calls=0)

    # ── Cache lookup ──
    cached: List[Segment] = []
    uncached: List[Segment] = []

    for seg in segments:
        k = _key(seg.text, src_lang, tgt_lang)
        hit = _cache.get(k)
        if hit is not None:
            _cache.move_to_end(k)  # mark as recently used so it survives eviction longer
            cached.append(seg.model_copy(update={"text": hit}))
        else:
            uncached.append(seg)

    logger.info("Cache: %d hits, %d misses", len(cached), len(uncached))

    if not uncached:
        return TranslationResult(
            segments=sorted(cached, key=lambda s: s.id),
            cache_hits=len(cached),
            api_calls=0,
        )

    # ── Deduplication ──
    by_text: Dict[str, List[Segment]] = {}
    for seg in uncached:
        by_text.setdefault(seg.text, []).append(seg)

    unique_texts = list(by_text.keys())
    deduped = len(uncached) - len(unique_texts)
    if deduped > 0:
        logger.info("Dedup: %d → %d unique (%d eliminated)",
                    len(uncached), len(unique_texts), deduped)

    # ── Sequential translation ──
    logger.info("Translating %d unique texts", len(unique_texts))
    newly_translated: List[Segment] = []
    translated_count = len(cached)
    total = len(segments)

    for original in unique_texts:
        if cancel_event and cancel_event.is_set():
            raise InterruptedError("Translation cancelled by client")
        output = client.translate_one(original, src_lang, tgt_lang, on_backoff=on_backoff)
        if output.success:
            _persist(_key(original, src_lang, tgt_lang), output.text)
        for seg in by_text[original]:
            newly_translated.append(seg.model_copy(update={"text": output.text}))
            translated_count += 1
            if on_progress:
                on_progress(translated_count, total)

    all_translated = sorted(cached + newly_translated, key=lambda s: s.id)

    return TranslationResult(
        segments=all_translated,
        cache_hits=len(cached),
        api_calls=len(unique_texts),
    )
