import { useEffect, useState } from 'react';
import { Pencil, X, Save } from 'lucide-react';

interface CsvPreviewProps {
  file: File;
  onFileUpdate?: (file: File) => void;
}

export function CsvPreview({ file, onFileUpdate }: CsvPreviewProps) {
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
