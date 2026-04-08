import React from 'react';

export default function PageSkeleton() {
  return (
    <div className="flex flex-col h-full w-full bg-slate-50 rounded-xl overflow-hidden shadow-sm border border-slate-200">
      <div className="h-14 bg-slate-100 border-b border-slate-200 animate-pulse"></div>
      <div className="flex-1 p-6 flex gap-6">
        <div className="flex-1 animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
        <div className="w-72 bg-slate-200 rounded-xl h-96 animate-pulse hidden lg:block"></div>
      </div>
    </div>
  );
}
