import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Search, Filter } from 'lucide-react';

function AccordionItem({ title, defaultOpen = false, children, isLast = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border-b border-slate-200 ${isLast ? 'border-b-0' : ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 bg-white hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 text-sm">{title}</span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-blue-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-blue-500" />
        )}
      </button>
      {isOpen && children && <div className="pb-3">{children}</div>}
    </div>
  );
}

export default function RightPanel() {
  return (
    <div className="w-80 shrink-0 flex flex-col gap-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800 text-base">Actions Pending</h2>
          <Filter className="w-4 h-4 text-slate-800" />
        </div>
        
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search Keywords"
            className="w-full bg-slate-100 border-none text-slate-700 text-sm rounded-md pl-3 pr-9 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-shadow placeholder:text-slate-400"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>

        <div className="flex flex-col">
          <AccordionItem title="Approvals Pending" defaultOpen={true} />
          <AccordionItem title="Interviews Pending" isLast={true} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <AccordionItem title="Job Filters" defaultOpen={true}>
          <div className="flex flex-col mt-2">
            <AccordionItem title="Designation" />
            <AccordionItem title="Hiring Manager" />
            <AccordionItem title="Dept Name" />
            <AccordionItem title="Job Visibility" />
            <AccordionItem title="Location" />
            <AccordionItem title="Recruiter" isLast={true} />
          </div>
        </AccordionItem>
      </div>
    </div>
  );
}
