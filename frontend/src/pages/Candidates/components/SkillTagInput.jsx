import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

export default function SkillTagInput({ skills, onChange }) {
  const [inputVal, setInputVal] = useState('');

  const addSkill = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed]);
    }
    setInputVal('');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {skills.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs font-medium">
            {s}
            <button type="button" onClick={() => onChange(skills.filter((_, j) => j !== i))} className="hover:text-rose-500 transition-colors ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {skills.length === 0 && <span className="text-xs text-slate-400 italic">No skills added yet</span>}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
          placeholder="Type a skill and press Enter…"
          className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <button type="button" onClick={addSkill} className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
}
