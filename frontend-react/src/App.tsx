import { useState } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { LanguageSelector } from './components/LanguageSelector';
import { ProgressTracker } from './components/ProgressTracker';
import { ResultPanel } from './components/ResultPanel';
import { useTranslation } from './hooks/useTranslation';
import { LanguageCode } from './types';
import { Sparkles } from 'lucide-react';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState<LanguageCode>('en');
  const [targetLang, setTargetLang] = useState<LanguageCode>('ne');
  
  const { state, error, stats, translateFile, reset } = useTranslation();

  const handleTranslate = () => {
    if (file) {
      translateFile(file, sourceLang, targetLang);
    }
  };

  const isProcessing = state === 'uploading' || state === 'processing';
  const isDone = state === 'done';

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col">
        
        <Header />

        <main className="flex-1 w-full flex flex-col pb-12">
          
          {/* Main Card */}
          <div className="glass-panel rounded-3xl p-6 md:p-10 relative overflow-hidden">
            {/* Inner subtle glow */}
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-accent-teal/5 blur-[80px] rounded-full pointer-events-none"></div>
            
            <div className="relative z-10 space-y-10">
              
              <FileUpload 
                file={file} 
                setFile={setFile} 
                disabled={isProcessing || isDone} 
              />
              
              <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-border to-transparent"></div>

              <LanguageSelector 
                sourceLang={sourceLang}
                targetLang={targetLang}
                onSourceChange={setSourceLang}
                onTargetChange={setTargetLang}
                disabled={isProcessing || isDone}
              />

              {/* Action Button */}
              {!isDone && (
                <div className="pt-4 flex justify-center">
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
                    {!file || isProcessing ? null : (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out"></div>
                    )}
                    <span className="relative flex items-center gap-2">
                      {isProcessing ? 'Processing...' : 'Translate Document'}
                      {!isProcessing && <Sparkles className="w-5 h-5" />}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Sections */}
          <ProgressTracker state={state} error={error} />
          
          <ResultPanel
            stats={stats}
            onReset={() => {
              setFile(null);
              reset();
            }} 
          />

        </main>
        
        <footer className="w-full text-center py-6 text-sm text-text-muted border-t border-border mt-auto">
          Built for Google TMT Hackathon 2026 Track B2 · Fast, Layout-Preserving, Context-Aware
        </footer>
      </div>
    </div>
  );
}

export default App;
