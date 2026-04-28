import { CheckCircle2, Layers, Zap, Clock, Server, Eye, RotateCcw } from 'lucide-react';
import { Chip } from './ui/Chip';
import { LanguageCode, LANGUAGES, TranslationStats } from '../types';

interface SuccessCardProps {
  stats: TranslationStats;
  filename: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  previewMode: boolean;
  onPreview: () => void;
  onReset: () => void;
}

export function SuccessCard({
  stats,
  filename,
  sourceLang,
  targetLang,
  previewMode,
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

    </div>
  );
}
