import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Search, Filter, X } from 'lucide-react';

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

function toggleValue(current = '', val) {
  const parts = current ? current.split(',') : [];
  return parts.includes(val)
    ? parts.filter((p) => p !== val).join(',')
    : [...parts, val].join(',');
}

function FilterCheckboxGroup({ options, filterKey, labelKey, valueKey, current, onChange }) {
  if (!options || options.length === 0) {
    return <p className="text-xs text-slate-400 py-1">No options available</p>;
  }
  return (
    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
      {options.map((opt) => {
        const val = String(opt[valueKey]);
        const checked = current ? current.split(',').includes(val) : false;
        return (
          <label key={val} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              className="accent-blue-500 shrink-0"
              checked={checked}
              onChange={() => onChange(filterKey, toggleValue(current, val))}
            />
            <span className="truncate">{opt[labelKey]}</span>
          </label>
        );
      })}
    </div>
  );
}

const VISIBILITY_OPTIONS = [
  { id: 'open',   name: 'Open' },
  { id: 'hidden', name: 'Hidden' },
  { id: 'closed', name: 'Closed' },
];

export default function RightPanel({ filters = {}, onFilterChange, filterOptions = {} }) {
  const hasActiveFilters = Object.values(filters).some((v) => v);

  const clearAll = () => {
    Object.keys(filters).forEach((k) => onFilterChange && onFilterChange(k, ''));
  };

  const recruiters = (filterOptions.hiring_managers || []).filter((u) => u.role === 'recruiter');

  return (
    <div className="w-80 shrink-0 flex flex-col gap-4">
      {/* Actions Pending */}
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

      {/* Job Filters */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-slate-800 text-sm">Job Filters</span>
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear all
            </button>
          )}
        </div>

        <div className="flex flex-col">
          <AccordionItem title="Designation" defaultOpen={false}>
            <FilterCheckboxGroup
              options={(filterOptions.designations || []).map((d) => ({ id: d, name: d }))}
              filterKey="designations"
              labelKey="name"
              valueKey="id"
              current={filters.designations}
              onChange={onFilterChange}
            />
          </AccordionItem>

          <AccordionItem title="Hiring Manager" defaultOpen={false}>
            <FilterCheckboxGroup
              options={filterOptions.hiring_managers || []}
              filterKey="hiring_managers"
              labelKey="full_name"
              valueKey="id"
              current={filters.hiring_managers}
              onChange={onFilterChange}
            />
          </AccordionItem>

          <AccordionItem title="Dept Name" defaultOpen={false}>
            <FilterCheckboxGroup
              options={filterOptions.departments || []}
              filterKey="departments"
              labelKey="name"
              valueKey="id"
              current={filters.departments}
              onChange={onFilterChange}
            />
          </AccordionItem>

          <AccordionItem title="Job Visibility" defaultOpen={false}>
            <FilterCheckboxGroup
              options={VISIBILITY_OPTIONS}
              filterKey="visibility"
              labelKey="name"
              valueKey="id"
              current={filters.visibility}
              onChange={onFilterChange}
            />
          </AccordionItem>

          <AccordionItem title="Location" defaultOpen={false}>
            <FilterCheckboxGroup
              options={(filterOptions.locations || []).map((l) => ({ id: l, name: l }))}
              filterKey="locations"
              labelKey="name"
              valueKey="id"
              current={filters.locations}
              onChange={onFilterChange}
            />
          </AccordionItem>

          <AccordionItem title="Recruiter" defaultOpen={false} isLast={true}>
            <FilterCheckboxGroup
              options={recruiters}
              filterKey="hiring_managers"
              labelKey="full_name"
              valueKey="id"
              current={filters.hiring_managers}
              onChange={onFilterChange}
            />
          </AccordionItem>
        </div>
      </div>
    </div>
  );
}
