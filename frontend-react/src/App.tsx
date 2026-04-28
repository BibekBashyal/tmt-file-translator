import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { LanguageSelector } from './components/LanguageSelector';
import { ProgressTracker } from './components/ProgressTracker';
import { DiffViewer } from './components/DiffViewer';
import { Modal } from './components/Modal';
import { useTranslation } from './hooks/useTranslation';
import { LanguageCode, LANGUAGES } from './types';
import { Sparkles, CheckCircle2, Layers, Zap, Clock, Server, Eye, RotateCcw, Check } from 'lucide-react';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState<LanguageCode>('en');
  const [targetLang, setTargetLang] = useState<LanguageCode>('ne');
  const [showDiff, setShowDiff] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);

  const {
    state, error, stats, progress, backoffUntil,
    resultFilename, translatedBlob, segments,
    translateFile, cancel, reset,
  } = useTranslation();

  const isProcessing = state === 'uploading' || state === 'translating';

  const handleTranslate = () => {
    if (file) translateFile(file, sourceLang, targetLang);
  };

  const handleRemoveFile = () => {
    setFile(null);
    reset();
  };

  const handleReset = () => {
    setFile(null);
    setShowDiff(false);
    reset();
  };

  useEffect(() => {
    if (state === 'done' && translatedBlob && !previewMode) {
      const url = URL.createObjectURL(translatedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', resultFilename);
      document.body.appendChild(a);
      a.click();
      a.parentNode?.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [state, translatedBlob, previewMode, resultFilename]);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col">

        <Header />

        <main className="flex-1 w-full flex flex-col pb-12">

          {/* Main Card — hidden once done */}
          {state !== 'done' && (
            <div className="glass-panel rounded-3xl p-6 md:p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-accent-teal/5 blur-[80px] rounded-full pointer-events-none" />

              <div className="relative z-10 space-y-10">
                <FileUpload
                  file={file}
                  setFile={setFile}
                  onRemove={handleRemoveFile}
                  disabled={isProcessing}
                  isProcessing={isProcessing}
                />

                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-border to-transparent" />

                <LanguageSelector
                  sourceLang={sourceLang}
                  targetLang={targetLang}
                  onSourceChange={setSourceLang}
                  onTargetChange={setTargetLang}
                  disabled={isProcessing}
                />

                <div className="pt-4 flex flex-col items-center gap-4">
                  <button
                    onClick={handleTranslate}
                    disabled={!file || isProcessing}
                    className={`
                      relative group overflow-hidden px-10 py-4 rounded-full font-semibold text-lg transition-all duration-300
                      ${!file || isProcessing
                        ? 'bg-secondary text-text-muted cursor-not-allowed border border-border'
                        : 'bg-white text-primary hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.2)]'}
                    `}
                  >
                    {(!file || isProcessing) ? null : (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out" />
                    )}
                    <span className="relative flex items-center gap-2">
                      {isProcessing ? 'Processing…' : 'Translate Document'}
                      {!isProcessing && <Sparkles className="w-5 h-5" />}
                    </span>
                  </button>

                  {/* Preview preference */}
                  <div className="relative group/pref">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        onClick={() => setPreviewMode(p => !p)}
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

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-3 py-2 rounded-lg text-xs bg-gray-950 text-white whitespace-nowrap opacity-0 group-hover/pref:opacity-100 transition-opacity duration-150 pointer-events-none z-30 border border-white/10 shadow-xl">
                      When unchecked, the file downloads automatically<br />after translation without opening the preview.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-gray-950" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <ProgressTracker
            state={state}
            error={error}
            progress={progress}
            backoffUntil={backoffUntil}
            onCancel={cancel}
          />

          {/* Success card */}
          {state === 'done' && translatedBlob && file && stats && (
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
                      {LANGUAGES[sourceLang]?.name ?? sourceLang} → {LANGUAGES[targetLang]?.name ?? targetLang} · {resultFilename}
                    </p>
                  </div>
                </div>

                {/* Stats chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <StatChip icon={<Layers className="w-3 h-3" />} label={`${stats.segmentCount} segments`} />
                  <StatChip
                    icon={<Zap className="w-3 h-3" />}
                    label={`${stats.segmentCount > 0 ? Math.round((stats.cacheHits / stats.segmentCount) * 100) : 0}% cached`}
                    variant="teal"
                  />
                  <StatChip icon={<Server className="w-3 h-3" />} label={`${stats.apiCalls} API calls`} />
                  <StatChip icon={<Clock className="w-3 h-3" />} label={`${(stats.processingTimeMs / 1000).toFixed(1)}s`} />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 mt-6">
                {previewMode && (
                  <button
                    onClick={() => setShowDiff(true)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold bg-white text-primary hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)]"
                  >
                    <Eye className="w-4 h-4" />
                    Preview &amp; Download
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm text-text-muted border border-border hover:text-text-main hover:bg-white/5 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  New Translation
                </button>
              </div>
            </div>
          )}

          {/* Diff modal */}
          {showDiff && translatedBlob && file && stats && (
            <Modal
              title="Translation Preview"
              subtitle={`${LANGUAGES[sourceLang]?.name ?? sourceLang} → ${LANGUAGES[targetLang]?.name ?? targetLang} · ${resultFilename}`}
              onClose={() => setShowDiff(false)}
            >
              <DiffViewer
                segments={segments}
                translatedBlob={translatedBlob}
                filename={resultFilename}
                stats={stats}
                sourceLang={sourceLang}
                targetLang={targetLang}
                originalFile={file}
                onReset={handleReset}
              />
            </Modal>
          )}

        </main>

        <footer className="w-full text-center py-6 text-sm text-text-muted border-t border-border mt-auto">
          Kathmandu University · Google TMT Hackathon 2026 · Track B2
        </footer>
      </div>
    </div>
  );
}

function StatChip({
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

export default App;
