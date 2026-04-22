import React from 'react';

export default function InfoRow({ label, children }) {
  return (
    <div className="flex py-3 border-b border-slate-100 last:border-0 gap-4">
      <span className="w-40 shrink-0 text-sm text-slate-500 font-medium">{label}</span>
      <div className="flex-1 text-sm text-slate-800 min-w-0">{children}</div>
    </div>
  );
}
