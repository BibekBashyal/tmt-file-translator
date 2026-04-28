import { useEffect, useState } from 'react';

interface PdfPreviewProps {
  file: File;
}

export function PdfPreview({ file }: PdfPreviewProps) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;

  return (
    <div className="glass-panel rounded-2xl overflow-hidden animate-fade-in">
      <p className="text-xs text-text-muted px-4 pt-3 pb-2">Preview (read-only)</p>
      <iframe src={url} className="w-full h-52 border-0" title="PDF Preview" />
    </div>
  );
}
