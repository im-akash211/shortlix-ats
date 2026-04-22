import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function FilterSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 text-sm">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && <div className="px-4 pb-4 flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}
