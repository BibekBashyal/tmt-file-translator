import React, { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileText, X, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { FilePreview } from './FilePreview';

interface FileUploadProps {
  file: File | null;
  setFile: (file: File) => void;
  onRemove: () => void;
  disabled: boolean;
  isProcessing: boolean;
}

export function FileUpload({ file, setFile, onRemove, disabled, isProcessing }: FileUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (selectedFile: File) => {
    setError(null);
    const validTypes = ['.pdf', '.docx', '.csv', '.tsv'];
    const extension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(extension)) {
      setError(`Unsupported file type: ${extension}. Supported: PDF, DOCX, CSV, TSV`);
      return false;
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
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

  const handleRemove = () => {
    if (inputRef.current) inputRef.current.value = '';
    setShowPreview(false);
    onRemove();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  if (file) {
    const ext = file.name.split('.').pop()?.toUpperCase() ?? 'FILE';
    return (
      <div className="flex flex-col gap-3 animate-fade-in">
        {/* File card */}
        <div className="glass-panel rounded-2xl p-5 flex items-center justify-between border-accent-blue/30 bg-accent-blue/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent-blue/20 rounded-xl">
              <FileText className="w-7 h-7 text-accent-blue" />
            </div>
            <div>
              <h3 className="font-semibold text-text-main leading-tight">{file.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-accent-blue/20 text-accent-blue">{ext}</span>
                <span className="text-xs text-text-muted">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isProcessing && (
              <button
                onClick={() => setShowPreview(p => !p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border
                  ${showPreview
                    ? 'bg-accent-blue/20 border-accent-blue/40 text-accent-blue'
                    : 'bg-white/5 border-border text-text-muted hover:text-text-main hover:bg-white/10'}`}
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showPreview ? 'Hide' : 'Preview'}
              </button>
            )}
            {!isProcessing && (
              <button
                onClick={handleRemove}
                className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors text-text-muted"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Inline preview panel */}
        {showPreview && <FilePreview file={file} />}
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
          <p className="text-xs text-text-muted">PDF, DOCX, CSV, TSV (Max. 10MB)</p>
        </div>
        <input
          ref={inputRef}
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
