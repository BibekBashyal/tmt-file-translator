import { useState } from 'react';
import axios from 'axios';
import { LanguageCode, TranslationState, TranslationStats } from '../types';

const API_BASE_URL = 'http://localhost:8080/api/v1';

export function useTranslation() {
  const [state, setState] = useState<TranslationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TranslationStats | null>(null);
  const [resultFilename, setResultFilename] = useState<string>('');

  const translateFile = async (
    file: File,
    sourceLang: LanguageCode,
    targetLang: LanguageCode
  ) => {
    setState('uploading');
    setError(null);
    setStats(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceLang', sourceLang);
    formData.append('targetLang', targetLang);

    try {
      // Simulate progress stages for better UX
      setTimeout(() => { if (state === 'uploading') setState('processing'); }, 1500);

      const response = await axios.post(`${API_BASE_URL}/translate`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        responseType: 'blob', // Important for file download
      });

      setState('done');

      // Extract stats from headers
      const headers = response.headers;
      setStats({
        segmentCount: parseInt(headers['x-segments-count'] || '0', 10),
        cacheHits: parseInt(headers['x-cache-hits'] || '0', 10),
        apiCalls: parseInt(headers['x-api-calls'] || '0', 10),
        processingTimeMs: parseInt(headers['x-processing-time-ms'] || '0', 10),
      });

      // Extract filename from Content-Disposition
      const contentDisposition = headers['content-disposition'];
      let filename = `translated_${file.name}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }
      setResultFilename(filename);

      // Auto-trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      setState('error');
      if (err.response && err.response.data instanceof Blob) {
        // Parse blob error response
        const text = await err.response.data.text();
        try {
            const json = JSON.parse(text);
            setError(json.message || 'Translation failed');
        } catch(e) {
            setError(text || 'Translation failed');
        }
      } else {
        setError(err.message || 'An unexpected error occurred');
      }
    }
  };

  const reset = () => {
    setState('idle');
    setError(null);
    setStats(null);
  };

  return { state, error, stats, resultFilename, translateFile, reset };
}
