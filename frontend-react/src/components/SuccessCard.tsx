import { CheckCircle2, Layers, Zap, Clock, Server, Eye, RotateCcw, Check } from 'lucide-react';
import { Chip } from './ui/Chip';
import { LanguageCode, LANGUAGES, TranslationStats } from '../types';

interface SuccessCardProps {
  stats: TranslationStats;
  filename: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  previewMode: boolean;
  onTogglePreviewMode: () => void;
  onPreview: () => void;
  onReset: () => void;
}

export function SuccessCard({
  stats,
  filename,
  sourceLang,
  targetLang,
  previewMode,
  onTogglePreviewMode,
  onPreview,
  onReset,
}: SuccessCardProps) {
  const srcName = LANGUAGES[sourceLang]?.name ?? sourceLang;
  const tgtName = LANGUAGES[targetLang]?.name ?? targetLang;
  const cacheHitRate = stats.segmentCount > 0
    ? Math.round((stats.cacheHits / stats.segmentCount) * 100)
    : 0;

  return (
    <div className="glass-panel rounded-3xl p-6 md:p-8 animate-slide-up mt-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">

        {/* Icon + title */}
        <div className="flex items-center gap-4 flex-1">
          <div className="p-3 rounded-2xl bg-accent-teal/15 text-accent-teal shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold text-text-main">Translation Complete</p>
            <p className="text-xs text-text-muted mt-0.5">
              {srcName} → {tgtName} · {filename}
            </p>
          </div>
        </div>

        {/* Stats chips */}
        <div className="flex flex-wrap items-center gap-2">
          <Chip icon={<Layers className="w-3 h-3" />} label={`${stats.segmentCount} segments`} />
          <Chip icon={<Zap className="w-3 h-3" />} label={`${cacheHitRate}% cached`} variant="teal" />
          <Chip icon={<Server className="w-3 h-3" />} label={`${stats.apiCalls} API calls`} />
          <Chip icon={<Clock className="w-3 h-3" />} label={`${(stats.processingTimeMs / 1000).toFixed(1)}s`} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-6">
        {previewMode && (
          <button
            onClick={onPreview}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold bg-white text-primary hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)]"
          >
            <Eye className="w-4 h-4" />
            Preview &amp; Download
          </button>
        )}

        <button
          onClick={onReset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm text-text-muted border border-border hover:text-text-main hover:bg-white/5 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          New Translation
        </button>
      </div>

      {/* Preview preference reminder */}
      <div className="relative group/pref mt-4">
        <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
          <div
            onClick={onTogglePreviewMode}
            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all duration-150
              ${previewMode
                ? 'bg-white border-white'
                : 'bg-transparent border-border hover:border-text-muted'}`}
          >
            {previewMode && <Check className="w-2.5 h-2.5 text-primary" />}
          </div>
          <span className="text-xs text-text-muted hover:text-text-main transition-colors">
            Preview before downloading
          </span>
        </label>
        <div className="absolute bottom-full left-0 mb-2 px-3 py-2 rounded-lg text-xs bg-gray-950 text-white whitespace-nowrap opacity-0 group-hover/pref:opacity-100 transition-opacity duration-150 pointer-events-none z-30 border border-white/10 shadow-xl">
          When unchecked, the file downloads automatically<br />after translation without opening the preview.
          <div className="absolute top-full left-4 border-x-4 border-x-transparent border-t-4 border-t-gray-950" />
        </div>
      </div>
    </div>
  );
}
