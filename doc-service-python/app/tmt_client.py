"""
TMT API client — sequential, throttled, with startup cooldown calibration.
Encapsulated in TmtClient so all mutable state is instance-owned.
"""

import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

import httpx

logger = logging.getLogger(__name__)

_CALIBRATION_FILE = Path(".tmt-cooldown")
_GLOBAL_BACKOFF_S = 65.0
_MAX_RETRIES = 5

_LANG_MAP = {"tam": "tmg"}


def _map(code: str) -> str:
    return _LANG_MAP.get(code, code)


@dataclass
class TranslationOutput:
    text: str
    success: bool


class TmtClient:
    def __init__(self) -> None:
        self._url = os.environ.get("TMT_API_URL", "https://tmt.ilprl.ku.edu.np/lang-translate")
        self._key = os.environ.get("TMT_API_KEY", "")
        self._cooldown_s: float = 1.0
        self._global_resume_at: float = 0.0

    def _await_resume(self) -> None:
        wait = self._global_resume_at - time.monotonic()
        if wait > 0:
            logger.info("Global quota backoff — waiting %.0fs", wait)
            time.sleep(wait)

    def _trigger_backoff(self) -> None:
        self._global_resume_at = max(
            self._global_resume_at, time.monotonic() + _GLOBAL_BACKOFF_S
        )
        logger.warning("429 — global backoff %.0fs", _GLOBAL_BACKOFF_S)

    def translate_one(
        self,
        text: str,
        src_lang: str,
        tgt_lang: str,
        on_backoff: Optional[Callable[[float], None]] = None,
    ) -> TranslationOutput:
        src, tgt = _map(src_lang), _map(tgt_lang)
        retry_delay = 2.0

        for attempt in range(1, _MAX_RETRIES + 1):
            self._await_resume()
            try:
                logger.info(
                    "TMT REQUEST [%d/%d] src=%s tgt=%s chars=%d",
                    attempt, _MAX_RETRIES, src, tgt, len(text),
                )
                t0 = time.monotonic()
                r = httpx.post(
                    self._url,
                    json={"text": text, "src_lang": src, "tgt_lang": tgt},
                    headers={
                        "Authorization": f"Bearer {self._key}",
                        "Content-Type": "application/json",
                    },
                    timeout=30.0,
                )
                elapsed_ms = (time.monotonic() - t0) * 1000

                if r.status_code == 429:
                    logger.error("TMT 429 [attempt=%d/%d]", attempt, _MAX_RETRIES)
                    if attempt < _MAX_RETRIES:
                        if on_backoff:
                            on_backoff(_GLOBAL_BACKOFF_S)
                        self._trigger_backoff()
                        time.sleep(retry_delay)
                        retry_delay = min(retry_delay * 2, 16.0)
                        continue
                    return TranslationOutput(text=text, success=False)

                r.raise_for_status()
                data = r.json()
                msg_type = data.get("message_type", "")
                output = data.get("output")

                logger.info(
                    "TMT RESPONSE [%.0fms] message_type=%s output_chars=%d",
                    elapsed_ms, msg_type, len(str(output)) if output else 0,
                )
                time.sleep(self._cooldown_s)

                if msg_type == "SUCCESS" and output is not None:
                    return TranslationOutput(text=str(output), success=True)

                logger.warning("TMT non-success: %s", msg_type)
                return TranslationOutput(text=text, success=False)

            except httpx.HTTPStatusError as e:
                logger.error("TMT HTTP error [attempt=%d]: %s", attempt, e)
                time.sleep(self._cooldown_s)
                return TranslationOutput(text=text, success=False)
            except Exception as e:
                logger.error("TMT call failed [attempt=%d]: %s", attempt, e)
                time.sleep(self._cooldown_s)
                return TranslationOutput(text=text, success=False)

        logger.error("All %d retries exhausted", _MAX_RETRIES)
        return TranslationOutput(text=text, success=False)

    def calibrate(self) -> None:
        if _CALIBRATION_FILE.exists():
            try:
                stored = float(_CALIBRATION_FILE.read_text().strip())
                if stored > 0:
                    self._cooldown_s = stored
                    logger.info("Loaded calibrated cooldown: %.2fs", self._cooldown_s)
                    return
            except Exception:
                pass

        logger.info("Calibrating request cooldown (runs once, then persisted)...")
        intervals = [0.5, 0.3, 0.2, 0.15]
        last_safe = 1.0

        for interval in intervals:
            logger.info("  Probing %.0fms × 5...", interval * 1000)
            if self._probe(interval, 5):
                last_safe = interval
                logger.info("  %.0fms: OK", interval * 1000)
            else:
                logger.info("  %.0fms: 429 — stopping probe", interval * 1000)
                time.sleep(_GLOBAL_BACKOFF_S)
                break

        self._cooldown_s = last_safe * 2
        logger.info("Calibration complete: cooldown=%.2fs", self._cooldown_s)
        try:
            _CALIBRATION_FILE.write_text(str(self._cooldown_s))
        except Exception as e:
            logger.warning("Could not persist cooldown: %s", e)

    def _probe(self, interval_s: float, count: int) -> bool:
        for _ in range(count):
            try:
                r = httpx.post(
                    self._url,
                    json={"text": "Hello", "src_lang": "en", "tgt_lang": "ne"},
                    headers={"Authorization": f"Bearer {self._key}"},
                    timeout=30.0,
                )
                if r.status_code == 429:
                    return False
                time.sleep(interval_s)
            except Exception:
                pass
        return True


client = TmtClient()


def calibrate() -> None:
    client.calibrate()
