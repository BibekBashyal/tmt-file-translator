import { useEffect, useRef, useState } from 'react';
import { TranslationProgress, TranslationState } from '../types';

export function formatEta(seconds: number): string {
  if (seconds < 5) return 'almost done';
  if (seconds < 60) return `~${seconds}s remaining`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `~${m}m remaining` : `~${m}m ${s}s remaining`;
}

interface UseEtaResult {
  eta: number | null;
  countdown: number | null;
}

export function useEta(
  state: TranslationState,
  progress: TranslationProgress | null,
  backoffUntil: number | null,
): UseEtaResult {
  const startTimeRef = useRef<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (state === 'translating' && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
    if (state !== 'translating') {
      startTimeRef.current = null;
    }
  }, [state]);

  useEffect(() => {
    if (!backoffUntil) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const left = Math.ceil((backoffUntil - Date.now()) / 1000);
      setCountdown(left > 0 ? left : null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [backoffUntil]);

  const eta: number | null = (() => {
    if (countdown !== null) return null;
    if (!progress || !startTimeRef.current || progress.current < 2) return null;
    const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
    const rate = progress.current / elapsedSec;
    const remaining = progress.total - progress.current;
    return Math.ceil(remaining / rate);
  })();

  return { eta, countdown };
}
