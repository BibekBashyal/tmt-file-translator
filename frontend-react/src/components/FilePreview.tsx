import { useEffect, useState } from 'react';
import { Pencil, X, Save } from 'lucide-react';

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

// ── CSV / TSV ────────────────────────────────────────────────────────────────

function CsvPreview({ file, onFileUpdate }: { file: File; onFileUpdate?: (f: File) => void }) {
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [editRows, setEditRows] = useState<string[][]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const delimiter = file.name.endsWith('.tsv') ? '\t' : ',';

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      const parsed = lines.map(l => l.split(delimiter).map(c => c.trim().replace(/^"|"$/g, '')));
      setAllRows(parsed);
    };
    reader.readAsText(file);
  }, [file, delimiter]);

  const startEdit = () => {
    setEditRows(allRows.map(r => [...r]));
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const saveEdit = () => {
    const csvContent = editRows
      .map(row => row.map(cell => {
        if (cell.includes(delimiter) || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(delimiter))
      .join('\n');

    const blob = new Blob([csvContent], { type: file.type || 'text/csv' });
    const newFile = new File([blob], file.name, { type: file.type });
    setAllRows(editRows);
    setIsEditing(false);
    onFileUpdate?.(newFile);
  };

  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    setEditRows(prev => prev.map((row, r) =>
      r === rowIdx ? row.map((cell, c) => c === colIdx ? value : cell) : row
    ));
  };

  if (!allRows.length) return null;

  const [header, ...body] = isEditing ? editRows : allRows;
  const displayBody = isEditing ? body : body.slice(0, 5);

  return (
    <div className="glass-panel rounded-2xl overflow-hidden animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="text-xs text-text-muted">
          {isEditing ? `Editing — ${allRows.length} rows` : `Preview — first 5 rows of ${allRows.length}`}
        </p>
        <div className="flex gap-2">
          {!isEditing && onFileUpdate && (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent-blue/15 border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/25 transition-colors"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
          {isEditing && (
            <>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 border border-border text-text-muted hover:bg-white/10 transition-colors"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent-blue/20 border border-accent-blue/40 text-accent-blue hover:bg-accent-blue/30 transition-colors"
              >
                <Save className="w-3 h-3" /> Save Changes
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto px-4 pb-4 max-h-56 overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {header.map((cell, j) => (
                <th key={j} className="text-left py-1.5 pr-3 pb-2 font-semibold text-text-main border-b border-border">
                  {isEditing
                    ? <input
                        value={editRows[0][j] ?? ''}
                        onChange={e => updateCell(0, j, e.target.value)}
                        className="w-full min-w-[80px] bg-secondary border border-accent-blue/30 rounded px-1.5 py-0.5 text-text-main outline-none focus:border-accent-blue"
                      />
                    : <span className="truncate block max-w-[160px]">{cell}</span>
                  }
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayBody.map((row, i) => (
              <tr key={i} className="border-b border-border/40 last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="py-1 pr-3">
                    {isEditing
                      ? <input
                          value={editRows[i + 1]?.[j] ?? ''}
                          onChange={e => updateCell(i + 1, j, e.target.value)}
                          className="w-full min-w-[80px] bg-secondary border border-border rounded px-1.5 py-0.5 text-text-muted outline-none focus:border-accent-blue focus:text-text-main"
                        />
                      : <span className="truncate block max-w-[160px] text-text-muted">{cell}</span>
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── PDF ──────────────────────────────────────────────────────────────────────

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
      <p className="text-xs text-text-muted px-4 pt-3 pb-2">Preview (read-only)</p>
      <iframe src={url} className="w-full h-52 border-0" title="PDF Preview" />
    </div>
  );
}

// ── DOCX ─────────────────────────────────────────────────────────────────────

function DocxPreview({ file, onFileUpdate }: { file: File; onFileUpdate?: (f: File) => void }) {
  const [html, setHtml] = useState('');
  const [editText, setEditText] = useState('');
  const [plainText, setPlainText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    import('mammoth').then((mammoth) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (cancelled) return;
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const [htmlResult, textResult] = await Promise.all([
            mammoth.convertToHtml({ arrayBuffer }),
            mammoth.extractRawText({ arrayBuffer }),
          ]);
          if (!cancelled) {
            setHtml(htmlResult.value);
            setPlainText(textResult.value);
            setEditText(textResult.value);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    });

    return () => { cancelled = true; };
  }, [file]);

  const saveEdit = () => {
    const blob = new Blob([editText], { type: 'text/plain' });
    const newFile = new File([blob], file.name.replace('.docx', '.txt'), { type: 'text/plain' });
    setIsEditing(false);
    onFileUpdate?.(newFile);
  };

  const cancelEdit = () => {
    setEditText(plainText);
    setIsEditing(false);
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="text-xs text-text-muted">
          {isEditing ? 'Editing text content (saves as .txt)' : 'Preview'}
        </p>
        <div className="flex gap-2">
          {!isEditing && !loading && onFileUpdate && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent-blue/15 border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/25 transition-colors"
            >
              <Pencil className="w-3 h-3" /> Edit Text
            </button>
          )}
          {isEditing && (
            <>
              <button onClick={cancelEdit} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 border border-border text-text-muted hover:bg-white/10 transition-colors">
                <X className="w-3 h-3" /> Cancel
              </button>
              <button onClick={saveEdit} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent-blue/20 border border-accent-blue/40 text-accent-blue hover:bg-accent-blue/30 transition-colors">
                <Save className="w-3 h-3" /> Save as .txt
              </button>
            </>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 max-h-52 overflow-y-auto">
        {loading && <p className="text-text-muted text-xs py-4 text-center">Loading preview…</p>}
        {!loading && isEditing && (
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            className="w-full h-40 bg-secondary border border-border rounded-lg p-3 text-sm text-text-main outline-none focus:border-accent-blue resize-none leading-relaxed"
          />
        )}
        {!loading && !isEditing && (
          <div
            className="text-sm text-text-main leading-relaxed
              [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2
              [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-1
              [&_p]:mb-2 [&_p]:text-text-muted
              [&_table]:w-full [&_table]:text-xs [&_td]:pr-3 [&_td]:py-0.5
              [&_strong]:text-text-main"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}
