import { useEffect, useState } from 'react';
import { Pencil, X, Save } from 'lucide-react';

interface DocxPreviewProps {
  file: File;
  onFileUpdate?: (file: File) => void;
}

export function DocxPreview({ file, onFileUpdate }: DocxPreviewProps) {
  const [html, setHtml] = useState('');
  const [plainText, setPlainText] = useState('');
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const saveEdit = async () => {
    setSaving(true);
    try {
      const { Document, Packer, Paragraph, TextRun } = await import('docx');
      const paragraphs = editText.split('\n').map(
        (line) => new Paragraph({ children: [new TextRun(line)] })
      );
      const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
      const blob = await Packer.toBlob(doc);
      const newFile = new File([blob], file.name, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      setPlainText(editText);
      setIsEditing(false);
      onFileUpdate?.(newFile);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditText(plainText);
    setIsEditing(false);
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="text-xs text-text-muted">
          {isEditing ? 'Editing text content' : 'Preview'}
        </p>
        <div className="flex gap-2">
          {!isEditing && !loading && onFileUpdate && (
            <button
              onClick={() => setIsEditing(true)}
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
                disabled={saving}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent-blue/20 border border-accent-blue/40 text-accent-blue hover:bg-accent-blue/30 transition-colors disabled:opacity-50"
              >
                <Save className="w-3 h-3" />
                {saving ? 'Saving…' : 'Save Changes'}
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
            onChange={(e) => setEditText(e.target.value)}
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
