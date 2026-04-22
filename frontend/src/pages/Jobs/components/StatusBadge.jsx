import React from 'react';

export default function StatusBadge({ status }) {
  const map = {
    open:      'bg-emerald-100 text-emerald-700',
    abandoned: 'bg-amber-100 text-amber-700',
    closed:    'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${map[status] || map.closed}`}>
      {status}
    </span>
  );
}
