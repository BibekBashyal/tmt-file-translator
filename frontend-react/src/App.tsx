import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { LanguageSelector } from './components/LanguageSelector';
import { ProgressTracker } from './components/ProgressTracker';
import { DiffViewer } from './components/DiffViewer';
import { Modal } from './components/Modal';
import { SuccessCard } from './components/SuccessCard';
import { useTranslation } from './hooks/useTranslation';
import { LanguageCode, LANGUAGES } from './types';
import { downloadBlob } from './utils/download';
import { Sparkles, Check } from 'lucide-react';

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

  // Auto-download when preview mode is off
  useEffect(() => {
    if (state === 'done' && translatedBlob && !previewMode) {
      downloadBlob(translatedBlob, resultFilename);
    }
  }, [state, translatedBlob, previewMode, resultFilename]);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col">

        <Header />

        <main className="flex-1 w-full flex flex-col pb-12">

          {/* Main card — hidden once done */}
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
            <SuccessCard
              stats={stats}
              filename={resultFilename}
              sourceLang={sourceLang}
              targetLang={targetLang}
              previewMode={previewMode}
              onTogglePreviewMode={() => setPreviewMode(p => !p)}
              onPreview={() => setShowDiff(true)}
              onReset={handleReset}
            />
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

export default App;
