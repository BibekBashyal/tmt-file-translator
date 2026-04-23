import { useEffect, useState } from 'react';

interface FilePreviewProps {
  file: File;
}

export function FilePreview({ file }: FilePreviewProps) {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv' || ext === 'tsv') return <CsvPreview file={file} />;
  if (ext === 'pdf') return <PdfPreview file={file} />;
  if (ext === 'docx') return <DocxPreview file={file} />;

  return null;
}

function CsvPreview({ file }: { file: File }) {
  const [rows, setRows] = useState<string[][]>([]);
  const delimiter = file.name.endsWith('.tsv') ? '\t' : ',';

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').slice(0, 6).filter(Boolean);
      setRows(lines.map(l => l.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''))));
    };
    reader.readAsText(file);
  }, [file, delimiter]);

  if (!rows.length) return null;

  const [header, ...body] = rows;

  return (
    <div className="glass-panel rounded-2xl p-4 animate-fade-in">
      <p className="text-xs text-text-muted mb-3">Preview — first 5 rows</p>
      <div className="overflow-x-auto max-h-44 overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {header.map((cell, j) => (
                <th key={j} className="text-left py-1.5 pr-4 pb-2 font-semibold text-text-main border-b border-border truncate max-w-[160px]">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, i) => (
              <tr key={i} className="border-b border-border/40 last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="py-1.5 pr-4 text-text-muted truncate max-w-[160px]">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PdfPreview({ file }: { file: File }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;

  return (
    <div className="glass-panel rounded-2xl overflow-hidden animate-fade-in">
      <p className="text-xs text-text-muted px-4 pt-3 pb-2">Preview</p>
      <iframe src={url} className="w-full h-52 border-0" title="PDF Preview" />
    </div>
  );
}

function DocxPreview({ file }: { file: File }) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    import('mammoth').then((mammoth) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (cancelled) return;
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (!cancelled) setHtml(result.value);
        } catch {
          if (!cancelled) setError('Could not render document.');
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    });

    return () => { cancelled = true; };
  }, [file]);

  return (
    <div className="glass-panel rounded-2xl overflow-hidden animate-fade-in">
      <p className="text-xs text-text-muted px-4 pt-3 pb-2">Preview — first page content</p>
      <div className="px-5 pb-4 max-h-52 overflow-y-auto text-sm text-text-main leading-relaxed
                      [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2
                      [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-1
                      [&_p]:mb-2 [&_p]:text-text-muted
                      [&_table]:w-full [&_table]:text-xs [&_td]:pr-3 [&_td]:py-0.5
                      [&_strong]:text-text-main [&_em]:italic">
        {loading && <p className="text-text-muted text-xs py-4 text-center">Loading preview…</p>}
        {error && <p className="text-red-400 text-xs py-4 text-center">{error}</p>}
        {!loading && !error && (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  );
}
