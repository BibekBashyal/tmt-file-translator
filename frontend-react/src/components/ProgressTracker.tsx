import { CheckCircle2, Loader2, FileDown, ShieldAlert, Clock, AlertTriangle, X } from 'lucide-react';
import { TranslationProgress, TranslationState } from '../types';
import { useEta, formatEta } from '../hooks/useEta';

interface ProgressTrackerProps {
  state: TranslationState;
  error: string | null;
  progress: TranslationProgress | null;
  backoffUntil: number | null;
  onCancel?: () => void;
}

export function ProgressTracker({ state, error, progress, backoffUntil, onCancel }: ProgressTrackerProps) {
  const { eta, countdown } = useEta(state, progress, backoffUntil);

  if (state === 'idle') return null;

  if (state === 'error') {
    return (
      <div className="glass-panel rounded-2xl p-6 border-red-500/30 bg-red-500/5 animate-slide-up mt-8">
        <div className="flex items-start space-x-4 text-red-400">
          <ShieldAlert className="w-8 h-8 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold mb-1 text-red-300">Translation Failed</h3>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    { id: 'uploading', label: 'Uploading Document', desc: 'Sending to server...' },
    { id: 'translating', label: 'Translating', desc: null },
    { id: 'done', label: 'Ready', desc: 'Translation complete.' },
  ];

  const currentIndex = state === 'done' ? 2 : state === 'translating' ? 1 : 0;
  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="glass-panel rounded-2xl p-8 animate-slide-up mt-8 relative overflow-hidden">
      {state !== 'done' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-blue/5 to-transparent -translate-x-[100%] animate-[shimmer_2s_infinite]" />
      )}

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {steps.map((step, index) => {
            const isActive = index === currentIndex;
            const isPast = index < currentIndex;
            const isDoneState = state === 'done' && index === 2;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-4 flex-1 ${index !== 2 ? 'w-full md:border-r border-border md:pr-4' : ''}`}
              >
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-500
                  ${isDoneState ? 'bg-accent-teal/20 text-accent-teal shadow-[0_0_15px_rgba(20,184,166,0.3)]' :
                    isPast ? 'bg-accent-blue/20 text-accent-blue' :
                    isActive ? 'bg-white/10 text-white animate-pulse' :
                    'bg-secondary text-text-muted border border-border'}
                `}>
                  {isDoneState || isPast
                    ? <CheckCircle2 className="w-5 h-5" />
                    : isActive
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <FileDown className="w-5 h-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold ${isActive || isPast || isDoneState ? 'text-text-main' : 'text-text-muted'}`}>
                    {step.label}
                  </h4>

                  {step.id === 'translating' && isActive && progress ? (
                    <div className="mt-2 space-y-1">
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent-blue transition-all duration-300 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-text-muted">
                        {progress.current} / {progress.total} sentences
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted mt-0.5">
                      {step.desc ?? (isActive ? 'Waiting for server...' : '')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {state === 'translating' && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            {countdown !== null ? (
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>API rate limited — retrying in {countdown}s</span>
              </div>
            ) : eta !== null ? (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{formatEta(eta)}</span>
              </div>
            ) : (
              <span />
            )}

            {onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted border border-border hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/5 transition-all duration-200"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
