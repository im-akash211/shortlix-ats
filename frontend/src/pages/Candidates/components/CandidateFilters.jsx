import React from 'react';
import { Filter } from 'lucide-react';
import FilterSection from './FilterSection';
import { SOURCE_LABELS, STAGE_LABELS } from '../constants';

export default function CandidateFilters({
  activeFilterCount,
  urlSources,
  urlStages,
  urlJob,
  expMin,
  expMax,
  dateFrom,
  dateTo,
  allJobs,
  toggleArrayFilter,
  clearAllFilters,
  setSearchParams,
  setExpFilter,
}) {
  return (
    <div className="w-60 shrink-0 flex flex-col min-h-0 overflow-y-auto pb-4 pr-0.5">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-blue-600 text-xs font-medium hover:underline"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Job Applied */}
        <FilterSection title="Job Applied" defaultOpen={false}>
          <select
            value={urlJob}
            onChange={(e) => setSearchParams(p => { if (e.target.value) p.set('job', e.target.value); else p.delete('job'); return p; }, { replace: true })}
            className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500 bg-white"
          >
            <option value="">All Jobs</option>
            {allJobs.map((j) => (
              <option key={j.id} value={j.id}>{j.job_code} — {j.title}</option>
            ))}
          </select>
        </FilterSection>

        {/* Status */}
        <FilterSection title="Status" defaultOpen>
          {Object.entries(STAGE_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-300 cursor-pointer accent-blue-600"
                checked={urlStages.includes(key)}
                onChange={() => toggleArrayFilter('stage', key)}
              />
              <span className="flex-1 leading-tight">{label}</span>
            </label>
          ))}
        </FilterSection>

        {/* Source */}
        <FilterSection title="Source" defaultOpen={false}>
          {Object.entries(SOURCE_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-300 cursor-pointer accent-blue-600"
                checked={urlSources.includes(key)}
                onChange={() => toggleArrayFilter('source', key)}
              />
              <span className="flex-1 leading-tight">{label}</span>
            </label>
          ))}
        </FilterSection>

        {/* Experience */}
        <FilterSection title="Experience (years)" defaultOpen={false}>
          <div className="flex items-center gap-2">
            <input
              type="number" min="0" step="0.5" placeholder="Min"
              value={expMin}
              onChange={(e) => setExpFilter('exp_min', e.target.value)}
              className="w-full border border-slate-300 rounded p-1.5 text-sm outline-none focus:border-blue-500 text-center"
            />
            <span className="text-slate-400 text-sm shrink-0">to</span>
            <input
              type="number" min="0" step="0.5" placeholder="Max"
              value={expMax}
              onChange={(e) => setExpFilter('exp_max', e.target.value)}
              className="w-full border border-slate-300 rounded p-1.5 text-sm outline-none focus:border-blue-500 text-center"
            />
          </div>
        </FilterSection>

        {/* Date Added */}
        <FilterSection title="Date Added" defaultOpen={false}>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setExpFilter('date_from', e.target.value)}
                className="border border-slate-300 rounded p-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setExpFilter('date_to', e.target.value)}
                className="border border-slate-300 rounded p-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </FilterSection>
      </div>{/* end single filter box */}
    </div>
  );
}
