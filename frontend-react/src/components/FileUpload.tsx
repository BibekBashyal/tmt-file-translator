import React, { useCallback } from 'react';
import { UploadCloud, FileText, X, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  file: File | null;
  setFile: (file: File | null) => void;
  disabled: boolean;
}

export function FileUpload({ file, setFile, disabled }: FileUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const validateFile = (selectedFile: File) => {
    setError(null);
    const validTypes = ['.pdf', '.docx', '.csv', '.tsv'];
    const extension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(extension)) {
      setError(`Unsupported file type: ${extension}. Supported: PDF, DOCX, CSV, TSV`);
      return false;
    }
    
    if (selectedFile.size > 1024 * 1024) {
      setError('File too large. Maximum size is 1MB.');
      return false;
    }
    
    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
      }
    }
  }, [disabled, setFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  if (file) {
    return (
      <div className="glass-panel rounded-2xl p-6 flex items-center justify-between animate-fade-in border-accent-blue/30 bg-accent-blue/5">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-accent-blue/20 rounded-xl">
            <FileText className="w-8 h-8 text-accent-blue" />
          </div>
          <div>
            <h3 className="font-semibold text-text-main">{file.name}</h3>
            <p className="text-sm text-text-muted">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
        {!disabled && (
          <button 
            onClick={() => setFile(null)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <label
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          flex flex-col items-center justify-center w-full h-48 
          border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300
          ${isDragging ? 'border-accent-blue bg-accent-blue/10 scale-[1.02]' : 'border-border bg-glass hover:bg-secondary/80'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadCloud className={`w-12 h-12 mb-4 ${isDragging ? 'text-accent-blue' : 'text-text-muted'}`} />
          <p className="mb-2 text-sm text-text-main">
            <span className="font-semibold text-accent-blue">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-text-muted">PDF, DOCX, CSV, TSV (Max. 1MB)</p>
        </div>
        <input 
          type="file" 
          className="hidden" 
          accept=".pdf,.docx,.csv,.tsv" 
          onChange={handleChange}
          disabled={disabled}
        />
      </label>

      {error && (
        <div className="mt-4 flex items-center space-x-2 text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-400/20 animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
