import { CsvPreview } from './preview/CsvPreview';
import { PdfPreview } from './preview/PdfPreview';
import { DocxPreview } from './preview/DocxPreview';

interface FilePreviewProps {
  file: File;
  onFileUpdate?: (file: File) => void;
}

export function FilePreview({ file, onFileUpdate }: FilePreviewProps) {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv' || ext === 'tsv') return <CsvPreview file={file} onFileUpdate={onFileUpdate} />;
  if (ext === 'pdf') return <PdfPreview file={file} />;
  if (ext === 'docx') return <DocxPreview file={file} onFileUpdate={onFileUpdate} />;

  return null;
}
