import { CheckCircle2, Loader2, FileDown, ShieldAlert } from 'lucide-react';
import { TranslationState } from '../types';

interface ProgressTrackerProps {
  state: TranslationState;
  error: string | null;
}

export function ProgressTracker({ state, error }: ProgressTrackerProps) {
  if (state === 'idle') return null;

  const steps = [
    { id: 'uploading', label: 'Uploading Document', desc: 'Sending to server...' },
    { id: 'processing', label: 'Translating Layout', desc: 'AI parsing & translating...' },
    { id: 'done', label: 'Ready', desc: 'Translation complete.' }
  ];

  const getCurrentStepIndex = () => {
    if (state === 'done') return 2;
    if (state === 'processing') return 1;
    return 0; // uploading
  };

  const currentIndex = getCurrentStepIndex();

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

  return (
    <div className="glass-panel rounded-2xl p-8 animate-slide-up mt-8 relative overflow-hidden">
      {/* Animated gradient background while processing */}
      {state !== 'done' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-blue/5 to-transparent -translate-x-[100%] animate-[shimmer_2s_infinite]"></div>
      )}

      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isPast = index < currentIndex;
          const isDoneState = state === 'done' && index === 2;

          return (
            <div key={step.id} className={`flex items-center gap-4 flex-1 ${index !== 2 ? 'w-full md:border-r border-border md:pr-4' : ''}`}>
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-500
                ${isDoneState ? 'bg-accent-teal/20 text-accent-teal shadow-[0_0_15px_rgba(20,184,166,0.3)]' : 
                  isPast ? 'bg-accent-blue/20 text-accent-blue' : 
                  isActive ? 'bg-white/10 text-white animate-pulse' : 
                  'bg-secondary text-text-muted border border-border'}
              `}>
                {isDoneState || isPast ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <FileDown className="w-5 h-5" />
                )}
              </div>
              
              <div>
                <h4 className={`font-semibold ${isActive || isPast || isDoneState ? 'text-text-main' : 'text-text-muted'}`}>
                  {step.label}
                </h4>
                <p className="text-xs text-text-muted mt-0.5">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
