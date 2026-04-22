import { ArrowRightLeft } from 'lucide-react';
import { LanguageCode, LANGUAGES } from '../types';

interface LanguageSelectorProps {
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  onSourceChange: (lang: LanguageCode) => void;
  onTargetChange: (lang: LanguageCode) => void;
  disabled: boolean;
}

export function LanguageSelector({
  sourceLang,
  targetLang,
  onSourceChange,
  onTargetChange,
  disabled
}: LanguageSelectorProps) {

  const handleSwap = () => {
    if (disabled) return;
    onSourceChange(targetLang);
    onTargetChange(sourceLang);
  };

  const getAvailableTargets = (source: LanguageCode) => {
    return (Object.keys(LANGUAGES) as LanguageCode[]).filter(k => k !== source);
  };

  return (
    <div className="flex items-center justify-between w-full space-x-4">
      {/* Source Language */}
      <div className="flex-1">
        <label className="block text-sm font-medium text-text-muted mb-2">Translate from</label>
        <select
          value={sourceLang}
          onChange={(e) => {
            const newSource = e.target.value as LanguageCode;
            onSourceChange(newSource);
            // Auto-update target if it matches new source
            if (newSource === targetLang) {
              onTargetChange(getAvailableTargets(newSource)[0]);
            }
          }}
          disabled={disabled}
          className="w-full bg-secondary border border-border text-text-main text-sm rounded-xl focus:ring-accent-blue focus:border-accent-blue block p-3 outline-none disabled:opacity-50 transition-colors"
        >
          {Object.values(LANGUAGES).map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name} ({lang.nativeName})
            </option>
          ))}
        </select>
      </div>

      {/* Swap Button */}
      <div className="flex flex-col justify-end h-full pt-6">
        <button
          onClick={handleSwap}
          disabled={disabled}
          className="p-3 bg-secondary border border-border rounded-full hover:bg-white/10 hover:border-accent-blue transition-all disabled:opacity-50 group"
          title="Swap languages"
        >
          <ArrowRightLeft className="w-5 h-5 text-text-muted group-hover:text-accent-blue group-active:scale-90 transition-all" />
        </button>
      </div>

      {/* Target Language */}
      <div className="flex-1">
        <label className="block text-sm font-medium text-text-muted mb-2">Translate to</label>
        <select
          value={targetLang}
          onChange={(e) => onTargetChange(e.target.value as LanguageCode)}
          disabled={disabled}
          className="w-full bg-secondary border border-border text-text-main text-sm rounded-xl focus:ring-accent-blue focus:border-accent-blue block p-3 outline-none disabled:opacity-50 transition-colors"
        >
          {getAvailableTargets(sourceLang).map((code) => {
            const lang = LANGUAGES[code];
            return (
              <option key={lang.code} value={lang.code}>
                {lang.name} ({lang.nativeName})
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
