import { useState } from 'react';
import { X } from 'lucide-react';

export default function TagInput({ value = [], onChange, placeholder, error }) {
  const [input, setInput] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  const addTag = (raw) => {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (input.trim()) addTag(input);
  };

  const startEdit = (index, e) => {
    e.stopPropagation();
    setEditingIndex(index);
    setEditingValue(value[index]);
  };

  const commitEdit = () => {
    const trimmed = editingValue.trim();
    if (trimmed) {
      const updated = [...value];
      // avoid duplicates with other tags (but allow same value = no-op)
      if (trimmed !== value[editingIndex] && value.includes(trimmed)) {
        // duplicate — just cancel
      } else {
        updated[editingIndex] = trimmed;
        onChange(updated);
      }
    }
    setEditingIndex(null);
    setEditingValue('');
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  const removeTag = (index, e) => {
    e.stopPropagation();
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div
      className={`flex flex-wrap gap-1.5 items-center min-h-[42px] px-3 py-2 border rounded-lg bg-white text-sm cursor-text focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 ${error ? 'border-red-400' : 'border-gray-300'}`}
      onClick={() => document.getElementById(`tag-input-${placeholder}`)?.focus()}
    >
      {value.map((tag, index) =>
        editingIndex === index ? (
          <input
            key={`edit-${index}`}
            autoFocus
            type="text"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') cancelEdit();
            }}
            onBlur={commitEdit}
            onClick={(e) => e.stopPropagation()}
            className="bg-blue-50 border border-blue-400 rounded px-2 py-0.5 text-xs font-medium text-blue-800 outline-none min-w-[80px] max-w-[200px]"
          />
        ) : (
          <span
            key={`${tag}-${index}`}
            className="flex items-center gap-1 bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs font-medium cursor-pointer hover:bg-blue-200 transition-colors min-w-0 max-w-full"
            onClick={(e) => startEdit(index, e)}
            title="Click to edit"
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              onClick={(e) => removeTag(index, e)}
              className="hover:text-red-600 transition-colors shrink-0"
            >
              <X size={11} />
            </button>
          </span>
        )
      )}
      <input
        id={`tag-input-${placeholder}`}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] outline-none bg-transparent placeholder:text-gray-400 text-gray-800"
      />
    </div>
  );
}
