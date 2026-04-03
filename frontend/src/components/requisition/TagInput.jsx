import { useState } from 'react';
import { X } from 'lucide-react';

export default function TagInput({ value = [], onChange, placeholder, error }) {
  const [input, setInput] = useState('');

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

  return (
    <div
      className={`flex flex-wrap gap-1.5 items-center min-h-[42px] px-3 py-2 border rounded-lg bg-white text-sm cursor-text focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 ${error ? 'border-red-400' : 'border-gray-300'}`}
      onClick={() => document.getElementById(`tag-input-${placeholder}`)?.focus()}
    >
      {value.map((tag) => (
        <span key={tag} className="flex items-center gap-1 bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs font-medium">
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(value.filter((t) => t !== tag)); }}
            className="hover:text-blue-900"
          >
            <X size={11} />
          </button>
        </span>
      ))}
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
