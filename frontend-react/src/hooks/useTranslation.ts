import { useState } from 'react';
import { LanguageCode, TranslationProgress, TranslationState, TranslationStats } from '../types';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export function useTranslation() {
  const [state, setState] = useState<TranslationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TranslationStats | null>(null);
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  const [backoffUntil, setBackoffUntil] = useState<number | null>(null);
  const [resultFilename, setResultFilename] = useState<string>('');

  const translateFile = async (
    file: File,
    sourceLang: LanguageCode,
    targetLang: LanguageCode
  ) => {
    setState('uploading');
    setError(null);
    setStats(null);
    setProgress(null);
    setBackoffUntil(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceLang', sourceLang);
    formData.append('targetLang', targetLang);

    try {
      const response = await fetch(`${API_BASE_URL}/translate/stream`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        try {
          const json = JSON.parse(text);
          throw new Error(json.detail || json.message || 'Translation failed');
        } catch {
          throw new Error(text || 'Translation failed');
        }
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          const event = JSON.parse(part.slice(6));

          if (event.type === 'extracted') {
            setState('translating');
            setProgress({ current: 0, total: event.total });
          } else if (event.type === 'segment') {
            setBackoffUntil(null);
            setProgress({ current: event.current, total: event.total });
          } else if (event.type === 'backoff') {
            setBackoffUntil(Date.now() + event.seconds * 1000);
          } else if (event.type === 'done') {
            setBackoffUntil(null);
            setStats({
              segmentCount: event.segmentCount,
              cacheHits: event.cacheHits,
              apiCalls: event.apiCalls,
              processingTimeMs: event.processingTimeMs,
            });
            setResultFilename(event.filename);

            const bytes = Uint8Array.from(atob(event.file), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: event.mediaType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', event.filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            URL.revokeObjectURL(url);

            setState('done');
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        }
      }
    } catch (err: unknown) {
      setState('error');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  const reset = () => {
    setState('idle');
    setError(null);
    setStats(null);
    setProgress(null);
    setBackoffUntil(null);
  };

  return { state, error, stats, progress, backoffUntil, resultFilename, translateFile, reset };
}
