import React, { useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Highlighter, Trash2, X,
  ChevronDown, ChevronUp,
} from 'lucide-react';

// ── Strip HTML → plain text (for preview) ──────────────────────────────────
export function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// ── Toolbar button ──────────────────────────────────────────────────────────
function ToolBtn({ onClick, active, title, children, disabled }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      } disabled:opacity-30`}
    >
      {children}
    </button>
  );
}

// ── Toolbar ─────────────────────────────────────────────────────────────────
export function Toolbar({ editor }) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-slate-200 bg-slate-50">
      {/* Bold */}
      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
        <Bold className="w-3.5 h-3.5" />
      </ToolBtn>
      {/* Italic */}
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
        <Italic className="w-3.5 h-3.5" />
      </ToolBtn>
      {/* Underline */}
      <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
        <UnderlineIcon className="w-3.5 h-3.5" />
      </ToolBtn>
      {/* Strikethrough */}
      <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
        <Strikethrough className="w-3.5 h-3.5" />
      </ToolBtn>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Text colour */}
      <label className="relative cursor-pointer p-1.5 rounded hover:bg-slate-100 transition-colors" title="Text colour">
        <span className="text-[11px] font-bold" style={{ color: editor.getAttributes('textStyle').color || '#1e293b' }}>A</span>
        <input
          type="color"
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          onInput={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </label>
      {/* Highlight */}
      <label className="relative cursor-pointer p-1.5 rounded hover:bg-slate-100 transition-colors" title="Highlight">
        <Highlighter className="w-3.5 h-3.5 text-amber-500" />
        <input
          type="color"
          defaultValue="#fef08a"
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          onInput={(e) => editor.chain().focus().setHighlight({ color: e.target.value }).run()}
        />
      </label>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Alignment */}
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
        <AlignLeft className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
        <AlignCenter className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
        <AlignRight className="w-3.5 h-3.5" />
      </ToolBtn>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Lists */}
      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
        <List className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolBtn>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Headings */}
      {[1, 2, 3].map(level => (
        <ToolBtn
          key={level}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          active={editor.isActive('heading', { level })}
          title={`Heading ${level}`}
        >
          <span className="text-[11px] font-bold">H{level}</span>
        </ToolBtn>
      ))}
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function NoteEditorModal({
  note,
  currentUser,
  onClose,
  onSave,
  onDelete,
  saving,
  deleting,
}) {
  const isAuthor   = String(note.user_id) === String(currentUser?.id);
  const isAdmin    = currentUser?.role === 'admin';
  const canDelete  = currentUser?.role === 'admin' || currentUser?.role === 'hiring_manager';
  const [historyOpen, setHistoryOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
    ],
    content: note.content || '',
    editable: isAuthor,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[160px] prose prose-sm max-w-none px-4 py-3 focus:outline-none',
      },
    },
  });

  const handleSave = useCallback(() => {
    if (!editor) return;
    onSave(editor.getHTML());
  }, [editor, onSave]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[400] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{note.user_name || 'Note'}</span>
            <span className="text-xs text-slate-400">
              {new Date(note.created_at).toLocaleString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
            {note.is_edited && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                Edited
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar — only for author */}
        {isAuthor && <Toolbar editor={editor} />}

        {/* Editor / read-only view */}
        <div className="flex-1 overflow-auto">
          {isAuthor ? (
            <EditorContent editor={editor} />
          ) : (
            <div
              className="prose prose-sm max-w-none px-4 py-3"
              dangerouslySetInnerHTML={{ __html: note.content }}
            />
          )}
        </div>

        {/* Edit history — admin only */}
        {isAdmin && note.is_edited && note.history?.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2 shrink-0 bg-slate-50">
            <button
              onClick={() => setHistoryOpen(o => !o)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              {historyOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {historyOpen ? 'Hide edit history' : `View edit history (${note.history.length})`}
            </button>
            {historyOpen && (
              <div className="mt-2 flex flex-col gap-3 max-h-40 overflow-auto">
                {note.history.map(h => (
                  <div key={h.id} className="border-l-2 border-slate-200 pl-3">
                    <p className="text-[10px] text-slate-400 mb-0.5">
                      {new Date(h.edited_at).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    <div
                      className="prose prose-sm max-w-none text-slate-500"
                      dangerouslySetInnerHTML={{ __html: h.content }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 shrink-0">
          <div>
            {canDelete && (
              <button
                onClick={onDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Deleting…' : 'Delete note'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700 px-4 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              {isAuthor ? 'Cancel' : 'Close'}
            </button>
            {isAuthor && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
