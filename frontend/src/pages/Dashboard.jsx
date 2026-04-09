import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageLoader } from '../components/LoadingDots';
import MetricCard from '../components/MetricCard';
import RightPanel from '../components/RightPanel';
import RecruitmentProgress from '../components/RecruitmentProgress';
import { Download, ChevronDown, Maximize2 } from 'lucide-react';
import { dashboard } from '../lib/api';
import { ROUTES } from '../routes/constants';

const STATUS_OPTIONS = ['open', 'hidden', 'closed', 'all'];

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Phase D: jobStatus is URL-backed so it survives browser back/forward and sharing
  const jobStatus = searchParams.get('status') || 'open';
  const setJobStatus = (val) => setSearchParams(p => { p.set('status', val); return p; });

  const [filters, setFilters] = useState({
    designations: '', hiring_managers: '', departments: '', locations: '', visibility: '',
  });

  // Compute query params (derived, not state — no extra useEffect needed)
  const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const effectiveStatus = activeFilters.visibility || (jobStatus === 'all' ? '' : jobStatus);
  const { visibility: _omit, ...restFilters } = activeFilters;
  const summaryParams = { status: effectiveStatus, ...restFilters };

  // Phase B: filter options — fetched once, cached indefinitely (they don't change during session)
  const { data: filterOptions = {} } = useQuery({
    queryKey: ['dashboard', 'filterOptions'],
    queryFn: dashboard.filterOptions,
    staleTime: Infinity,
  });

  // Phase B+C: summary — cached per filter combination; previous data shown during filter switch
  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['dashboard', 'summary', summaryParams],
    queryFn: () => dashboard.summary(summaryParams),
    placeholderData: (previousData) => previousData,
  });

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const metrics = summaryData
    ? summaryData.metrics.map((m) => {
        const hasHistory = m.history && m.history.some(d => d.value > 0);
        return {
          title: m.title,
          value: String(m.value),
          trend: `LAST WEEK ${m.trend_pct ?? 0}%`,
          trendUp: m.trend_up ?? null,
          type: hasHistory ? (m.title === 'Views' ? 'line' : 'bar') : 'empty',
          data: m.history || [],
          onClick:
            m.title === 'Jobs' || m.title === 'Applies'
              ? () => navigate(ROUTES.JOBS.ROOT)
              : undefined,
        };
      })
    : Array(12).fill(null).map((_, i) => ({
        title: ['Jobs','Views','Applies','Pending','Shortlists','Interviews',
                'Final Selects','Offers','Joined','On Hold','Rejects','Not Joined'][i],
        value: '…',
        trend: '',
        trendUp: null,
        type: 'empty',
        data: [],
      }));

  const progress = summaryData?.recruitment_progress;

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end items-center mb-6 gap-6">
        <div className="flex items-center gap-2">
          <button className="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
          <div className="border-b-2 border-slate-800 pb-1 flex items-center gap-1 cursor-pointer">
            <span className="text-sm font-semibold text-slate-800">Live</span>
            <ChevronDown className="w-4 h-4 text-slate-800" />
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-slate-600">
          {STATUS_OPTIONS.map((s) => (
            <label key={s} className="flex items-center gap-1.5 cursor-pointer capitalize">
              <input
                type="radio"
                name="status"
                className="accent-blue-500"
                checked={jobStatus === s}
                onChange={() => setJobStatus(s)}
              />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </label>
          ))}
        </div>

        <button className="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded transition-colors">
          <Download className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto pr-2 pb-4">
          {isLoading ? (
            <PageLoader label="Loading metrics…" />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-min mb-6">
                {metrics.map((metric, index) => (
                  <MetricCard key={index} {...metric} />
                ))}
              </div>
              <RecruitmentProgress progress={progress} />
            </>
          )}
        </div>
        <RightPanel filters={filters} onFilterChange={handleFilterChange} filterOptions={filterOptions} />
      </div>
    </div>
  );
}
