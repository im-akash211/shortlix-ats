import React, { useState } from 'react';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';
import FilterAccordion from './FilterAccordion';

function DateRangeFilter({ dateFrom, dateTo, onFromChange, onToChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasValue = dateFrom || dateTo;
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          Created Date
          {hasValue && <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />}
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">From</label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => onFromChange(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">To</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => onToChange(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {hasValue && (
            <button
              onClick={() => { onFromChange(''); onToChange(''); }}
              className="text-xs text-blue-600 hover:underline text-left"
            >
              Clear dates
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SortFilter({ ordering, onChange }) {
  const [isOpen, setIsOpen] = useState(true);
  const options = [
    { value: '-created_at', label: 'Newest First' },
    { value: 'created_at',  label: 'Oldest First' },
  ];
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 text-sm">Sort By</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 flex flex-col gap-2.5">
          {options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer">
              <input
                type="radio"
                name="jobs_sort"
                className="accent-blue-600 cursor-pointer"
                checked={ordering === opt.value}
                onChange={() => onChange(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JobFilters({
  filterOptions,
  filters,
  activeFilterCount,
  onToggle,
  onClearFilters,
  dateFrom,
  dateTo,
  ordering,
  onDateFromChange,
  onDateToChange,
  onOrderingChange,
}) {
  return (
    <div className="w-60 shrink-0 flex flex-col min-h-0 overflow-y-auto pb-4 pr-1">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={onClearFilters} className="text-blue-600 text-xs font-medium hover:underline">
              Clear All
            </button>
          )}
        </div>
        <FilterAccordion
          title="Department"
          options={filterOptions.departments}
          selected={filters.department}
          onToggle={(id) => onToggle('department', id)}
          defaultOpen
        />
        <FilterAccordion
          title="Hiring Manager"
          options={filterOptions.hiringManagers}
          selected={filters.hiring_manager}
          onToggle={(id) => onToggle('hiring_manager', id)}
          defaultOpen={false}
        />
        <FilterAccordion
          title="Location"
          options={filterOptions.locations}
          selected={filters.location}
          onToggle={(id) => onToggle('location', id)}
          defaultOpen={false}
        />
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFromChange={onDateFromChange}
          onToChange={onDateToChange}
        />
        <SortFilter ordering={ordering} onChange={onOrderingChange} />
      </div>
    </div>
  );
}
