import { useState, useMemo, useCallback } from 'react';
import {
  Download, Pencil, X, Search, RefreshCw,
  Zap, Layers, Clock, Server, RotateCcw,
} from 'lucide-react';
import { LanguageCode, LANGUAGES, SegmentDiff, TranslationStats } from '../types';

const API_BASE_URL = 'http://localhost:8000';

interface DiffViewerProps {
  segments: SegmentDiff[];
  translatedBlob: Blob;
  filename: string;
  stats: TranslationStats;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  originalFile: File;
  onReset: () => void;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', name);
  document.body.appendChild(a);
  a.click();
  a.parentNode?.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DiffViewer({
  segments: initial,
  translatedBlob,
  filename,
  stats,
  sourceLang,
  targetLang,
  originalFile,
  onReset,
}: DiffViewerProps) {
  const [segments, setSegments] = useState<SegmentDiff[]>(initial);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);

  const modifiedIds = useMemo(() => {
    const ids = new Set<number>();
    segments.forEach((s, i) => {
      if (s.translated !== initial[i]?.translated) ids.add(s.id);
    });
    return ids;
  }, [segments, initial]);

  const hasEdits = modifiedIds.size > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter(
      (s) => s.original.toLowerCase().includes(q) || s.translated.toLowerCase().includes(q)
    );
  }, [segments, search]);

  const updateSegment = useCallback((id: number, value: string) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, translated: value } : s)));
  }, []);

  const resetEdits = () => setSegments(initial);

  const cancelEdit = () => {
    resetEdits();
    setEditMode(false);
  };

  const handleDownload = async () => {
    setRebuildError(null);

    if (!hasEdits) {
      downloadBlob(translatedBlob, filename);
      return;
    }

    setRebuilding(true);
    try {
      const formData = new FormData();
      formData.append('file', originalFile);
      formData.append(
        'segments',
        JSON.stringify(segments.map((s) => ({ id: s.id, text: s.translated, meta: s.meta })))
      );
      const res = await fetch(`${API_BASE_URL}/reconstruct`, { method: 'POST', body: formData });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(JSON.parse(text)?.detail ?? text ?? 'Reconstruction failed');
      }
      downloadBlob(await res.blob(), filename);
      setEditMode(false);
    } catch (e) {
      setRebuildError(e instanceof Error ? e.message : 'Reconstruction failed');
    } finally {
      setRebuilding(false);
    }
  };

  const cacheHitRate = stats.segmentCount > 0
    ? Math.round((stats.cacheHits / stats.segmentCount) * 100)
    : 0;

  const srcName = LANGUAGES[sourceLang]?.name ?? sourceLang;
  const tgtName = LANGUAGES[targetLang]?.name ?? targetLang;

  return (
    <div className="flex flex-col h-full">

      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-border flex flex-wrap items-center gap-3 flex-shrink-0">
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search segments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary border border-border rounded-lg text-text-main placeholder:text-text-muted outline-none focus:border-accent-blue transition-colors"
          />
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-1.5">
          <Chip icon={<Layers className="w-3 h-3" />} label={`${stats.segmentCount} segs`} />
          <Chip icon={<Zap className="w-3 h-3" />} label={`${cacheHitRate}% cached`} variant="teal" />
          <Chip icon={<Server className="w-3 h-3" />} label={`${stats.apiCalls} calls`} />
          <Chip icon={<Clock className="w-3 h-3" />} label={`${(stats.processingTimeMs / 1000).toFixed(1)}s`} />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {editMode && hasEdits && (
            <button
              onClick={resetEdits}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-main border border-border hover:bg-white/5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset edits
            </button>
          )}

          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-border text-text-muted hover:text-text-main hover:bg-white/10 transition-all"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit translations
            </button>
          ) : (
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-muted hover:text-text-main hover:bg-white/5 transition-all"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}

          <button
            onClick={handleDownload}
            disabled={rebuilding}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-primary hover:scale-105 active:scale-100 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Download className="w-3.5 h-3.5" />
            {rebuilding ? 'Building…' : hasEdits ? 'Save & Download' : 'Download'}
          </button>
        </div>
      </div>

      {/* ── Rebuild error ──────────────────────────────────────── */}
      {rebuildError && (
        <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400 flex-shrink-0">
          {rebuildError}
        </div>
      )}

      {/* ── Edit hint ──────────────────────────────────────────── */}
      {editMode && (
        <div className="px-6 py-2 bg-accent-blue/5 border-b border-accent-blue/10 text-xs text-accent-blue/80 flex items-center justify-between flex-shrink-0">
          <span>Click any cell in the right column to edit. Changes are highlighted.</span>
          {hasEdits && (
            <span className="font-medium text-amber-400">{modifiedIds.size} segment{modifiedIds.size !== 1 ? 's' : ''} modified</span>
          )}
        </div>
      )}

      {/* ── Column headers ─────────────────────────────────────── */}
      <div className="grid grid-cols-[3rem_1fr_1fr] border-b border-border bg-white/[0.02] sticky top-0 z-10 flex-shrink-0">
        <div className="px-3 py-2.5" />
        <div className="px-5 py-2.5 text-[11px] font-semibold text-text-muted uppercase tracking-widest border-r border-border">
          Original · {srcName}
        </div>
        <div className="px-5 py-2.5 text-[11px] font-semibold text-text-muted uppercase tracking-widest">
          Translated · {tgtName}
        </div>
      </div>

      {/* ── Segment rows ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/30 min-h-0">
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-text-muted py-12">
            No segments match "{search}"
          </p>
        ) : (
          filtered.map((seg) => {
            const modified = modifiedIds.has(seg.id);
            return (
              <div
                key={seg.id}
                className={`grid grid-cols-[3rem_1fr_1fr] group transition-colors
                  ${modified ? 'bg-amber-500/5' : 'hover:bg-white/[0.015]'}`}
              >
                {/* Row number */}
                <div className="flex items-start justify-center pt-3.5 pb-3">
                  <span className="text-[10px] font-mono text-text-muted/40 leading-none">
                    {seg.id}
                  </span>
                </div>

                {/* Original */}
                <div className="px-5 py-3 text-sm text-text-muted leading-relaxed border-r border-border/40 select-text">
                  {seg.original}
                </div>

                {/* Translated */}
                <div className={`px-5 py-3 text-sm leading-relaxed ${modified ? 'border-l-2 border-amber-400/50' : ''}`}>
                  {editMode ? (
                    <textarea
                      value={seg.translated}
                      onChange={(e) => updateSegment(seg.id, e.target.value)}
                      rows={Math.max(2, Math.ceil(seg.translated.length / 60))}
                      className="w-full bg-secondary border border-border/60 rounded-md px-2.5 py-1.5 text-sm text-text-main outline-none focus:border-accent-blue resize-none leading-relaxed transition-colors placeholder:text-text-muted"
                    />
                  ) : (
                    <span className={modified ? 'text-amber-200' : 'text-text-main'}>
                      {seg.translated}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-t border-border flex items-center justify-between flex-shrink-0">
        <p className="text-xs text-text-muted">
          {filtered.length === segments.length
            ? `${segments.length} segments`
            : `${filtered.length} of ${segments.length} segments`}
        </p>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New translation
        </button>
      </div>
    </div>
  );
}

function Chip({
  icon,
  label,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  variant?: 'teal';
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ${
        variant === 'teal'
          ? 'bg-accent-teal/10 border-accent-teal/20 text-accent-teal'
          : 'bg-white/5 border-border text-text-muted'
      }`}
    >
      {icon}
      {label}
    </div>
  );
}
