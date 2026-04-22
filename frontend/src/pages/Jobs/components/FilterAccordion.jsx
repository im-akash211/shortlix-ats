import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function FilterAccordion({ title, options, selected, onToggle, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 text-sm">{title}</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 flex flex-col gap-2.5 max-h-[350px] overflow-y-auto scrollbar-thin">
          {options.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No options</p>
          ) : (
            options.map((opt) => (
              <label key={opt.id} className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-300 cursor-pointer accent-blue-600"
                  checked={selected.includes(opt.id)}
                  onChange={() => onToggle(opt.id)}
                />
                <span className="flex-1 leading-tight">{opt.label}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
