import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, SlidersHorizontal, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { PageLoader } from '../components/LoadingDots';
import { interviews as interviewsApi } from '../lib/api';
import { useAuth } from '../lib/authContext';
import InterviewPanel from '../components/interviews/InterviewPanel';

// ─── Constants ──────────────────────────────────────────────────────────────

const ROUND_LABELS = {
  R1: 'Round 1', R2: 'Round 2', R3: 'Round 3',
  CLIENT: 'Client Round', CDO: 'CDO Round', MGMT: 'Management Round',
};

const STATUS_BADGE = {
  SCHEDULED: { label: 'Scheduled', bg: 'bg-blue-100',    text: 'text-blue-700'    },
  COMPLETED: { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  ON_HOLD:   { label: 'On Hold',   bg: 'bg-amber-100',   text: 'text-amber-700'   },
  CANCELLED: { label: 'Cancelled', bg: 'bg-slate-100',   text: 'text-slate-500'   },
  MISSED:    { label: 'Missed',    bg: 'bg-orange-100',  text: 'text-orange-700'  },
};

function computedDisplayStatus(iv) {
  if (iv.status === 'cancelled') return 'CANCELLED';
  const cs = iv.computed_status || 'SCHEDULED';
  const timePassed = new Date(iv.scheduled_at) < new Date();
  if (cs === 'SCHEDULED' && timePassed) return 'MISSED';
  return cs;
}

function formatSchedule(scheduledAt, endTime, durationMin) {
  const start = new Date(scheduledAt);
  const end = endTime ? new Date(endTime) : new Date(start.getTime() + (durationMin || 60) * 60000);
  const date  = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const startT = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const endT   = end.toLocaleTimeString('en-US',   { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date}  ${startT} – ${endT}`;
}

function isPendingFeedback(iv) {
  return iv.status === 'scheduled' && new Date(iv.scheduled_at) < new Date();
}

// ─── Sort icon ──────────────────────────────────────────────────────────────

function SortIcon({ field, sort }) {
  if (sort.field !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 inline ml-1" />;
  return sort.dir === 'asc'
    ? <ChevronUp   className="w-3.5 h-3.5 text-blue-500 inline ml-1" />
    : <ChevronDown className="w-3.5 h-3.5 text-blue-500 inline ml-1" />;
}

// ─── Filters panel ──────────────────────────────────────────────────────────

function FilterBar({ filters, onChange, onClear }) {
  const hasAny = Object.values(filters).some(Boolean);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 bg-slate-50/60 flex-wrap">
      <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />

      <input
        type="text"
        value={filters.job_title}
        onChange={(e) => onChange('job_title', e.target.value)}
        placeholder="Job title…"
        className="border border-slate-200 rounded-md px-2.5 py-1 text-xs outline-none focus:border-blue-400 w-36 bg-white"
      />

      <select
        value={filters.stage}
        onChange={(e) => onChange('stage', e.target.value)}
        className="border border-slate-200 rounded-md px-2 py-1 text-xs outline-none focus:border-blue-400 bg-white"
      >
        <option value="">All rounds</option>
        {Object.entries(ROUND_LABELS).map(([val, lbl]) => (
          <option key={val} value={val}>{lbl}</option>
        ))}
      </select>

      <input
        type="date"
        value={filters.date_from}
        onChange={(e) => onChange('date_from', e.target.value)}
        className="border border-slate-200 rounded-md px-2 py-1 text-xs outline-none focus:border-blue-400 bg-white"
        title="From date"
      />
      <span className="text-slate-400 text-xs">–</span>
      <input
        type="date"
        value={filters.date_to}
        onChange={(e) => onChange('date_to', e.target.value)}
        className="border border-slate-200 rounded-md px-2 py-1 text-xs outline-none focus:border-blue-400 bg-white"
        title="To date"
      />

      {hasAny && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 font-medium ml-auto"
        >
          <X className="w-3.5 h-3.5" /> Clear filters
        </button>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Interviews() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = user?.role;
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultTab = role === 'recruiter' ? 'scheduled_by_me'
    : role === 'hiring_manager'           ? 'hm_interviews'
    : 'my';
  const activeTab = searchParams.get('tab') || defaultTab;
  const setActiveTab = (val) => {
    setSearchParams((p) => { p.set('tab', val); return p; });
    setActiveFilter(null);
  };

  const [selected, setSelected]             = useState(null);
  const [search, setSearch]                 = useState('');
  const [activeFilter, setActiveFilter]     = useState(null);
  const [showFilters, setShowFilters]       = useState(false);
  const [isCancelConfirm, setIsCancelConfirm] = useState(false);
  const [filters, setFilters] = useState({
    job_title: '', stage: '', date_from: '', date_to: '',
  });
  // sort: { field: 'candidate_name' | 'scheduled_at', dir: 'asc' | 'desc' }
  const [sort, setSort] = useState({ field: 'scheduled_at', dir: 'desc' });

  const cycleSort = (field) => {
    setSort((s) =>
      s.field === field
        ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' }
    );
  };

  const handleFilterChange = (key, val) => setFilters((f) => ({ ...f, [key]: val }));
  const clearFilters = () => setFilters({ job_title: '', stage: '', date_from: '', date_to: '' });

  // Build query params — backend filters included
  const queryParams = { tab: activeTab, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };

  const { data: listData, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['interviews', 'list', activeTab, filters],
    queryFn: () => interviewsApi.list(queryParams),
    placeholderData: (prev) => prev,
  });

  const data = listData ? (listData.results || listData) : [];
  const now  = new Date();

  // Client-side search (candidate name / job title) — a light UX layer on top of backend filters
  const filteredData = search.trim()
    ? data.filter((iv) =>
        iv.candidate_name?.toLowerCase().includes(search.toLowerCase()) ||
        iv.job_title?.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  // Summary counts
  const summary = {
    pending_confirmation: 0,
    upcoming:        data.filter((iv) => iv.status === 'scheduled' && new Date(iv.scheduled_at) >= now).length,
    pending_feedback: data.filter(isPendingFeedback).length,
    completed:       data.filter((iv) => iv.status === 'completed').length,
  };

  // Filter-card selection
  let displayData = filteredData;
  if (activeFilter === 'upcoming')
    displayData = filteredData.filter((iv) => iv.status === 'scheduled' && new Date(iv.scheduled_at) >= now);
  else if (activeFilter === 'pending_feedback')
    displayData = filteredData.filter(isPendingFeedback);
  else if (activeFilter === 'completed')
    displayData = filteredData.filter((iv) => iv.status === 'completed');

  // Client-side sort
  displayData = [...displayData].sort((a, b) => {
    let valA, valB;
    if (sort.field === 'candidate_name') {
      valA = (a.candidate_name ?? '').toLowerCase();
      valB = (b.candidate_name ?? '').toLowerCase();
    } else {
      valA = new Date(a.scheduled_at).getTime();
      valB = new Date(b.scheduled_at).getTime();
    }
    if (valA < valB) return sort.dir === 'asc' ? -1 : 1;
    if (valA > valB) return sort.dir === 'asc' ?  1 : -1;
    return 0;
  });

  const handleCancel = async (id) => {
    try {
      await interviewsApi.cancel(id);
      setIsCancelConfirm(false);
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
    } catch (err) {
      alert(err.data?.error || 'Failed to cancel interview');
    }
  };

  const summaryCards = [
    { key: 'pending_confirmation', label: 'Pending Confirmation', value: summary.pending_confirmation, activeBg: 'bg-amber-500   border-amber-500',   activeText: 'text-white', activeSub: 'text-amber-100'   },
    { key: 'upcoming',             label: 'Upcoming Interviews',  value: summary.upcoming,             activeBg: 'bg-blue-600    border-blue-600',    activeText: 'text-white', activeSub: 'text-blue-100'    },
    { key: 'pending_feedback',     label: 'Pending Feedback',     value: summary.pending_feedback,     activeBg: 'bg-rose-500    border-rose-500',    activeText: 'text-white', activeSub: 'text-rose-100'    },
    { key: 'completed',            label: 'Interviews Completed', value: summary.completed,            activeBg: 'bg-emerald-600 border-emerald-600', activeText: 'text-white', activeSub: 'text-emerald-100' },
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const isActive = activeFilter === card.key;
          return (
            <button
              key={card.key}
              onClick={() => setActiveFilter(isActive ? null : card.key)}
              className={`border rounded-xl p-5 shadow-sm flex items-center gap-4 transition-colors text-left w-full cursor-pointer hover:shadow-md ${
                isActive ? card.activeBg : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={`text-4xl font-bold ${isActive ? card.activeText : 'text-slate-800'}`}>{card.value}</span>
              <span className={`font-medium text-sm leading-tight ${isActive ? card.activeSub : 'text-slate-500'}`}>{card.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main List */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden min-h-0">

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1">
            {[
              { key: 'my',              label: 'My Interviews',   roles: ['admin', 'interviewer'] },
              { key: 'scheduled_by_me', label: 'Scheduled by Me', roles: ['admin', 'recruiter'] },
              { key: 'hm_interviews',   label: 'My Interviews',   roles: ['hiring_manager'] },
              { key: 'all',             label: 'All Schedules',   roles: ['admin', 'hiring_manager', 'recruiter', 'interviewer'] },
            ].filter((t) => t.roles.includes(role)).map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Live count of displayed interviews */}
          <span className="text-xs text-slate-500 font-medium px-2 py-1 bg-slate-100 rounded-full">
            {displayData.length} interview{displayData.length !== 1 ? 's' : ''} found
          </span>

          {/* Right side: filter toggle + search */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showFilters || Object.values(filters).some(Boolean)
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {Object.values(filters).some(Boolean) && (
                <span className="ml-0.5 bg-blue-600 text-white text-[10px] px-1 rounded-full">
                  {Object.values(filters).filter(Boolean).length}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-64">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidate or job…"
                className="bg-transparent outline-none text-sm w-full"
              />
            </div>
          </div>
        </div>

        {/* Filters bar */}
        {showFilters && (
          <FilterBar filters={filters} onChange={handleFilterChange} onClear={clearFilters} />
        )}

        {/* Table */}
        <div className="overflow-auto flex-1">
          {isLoading || isPlaceholderData ? (
            <PageLoader label="Loading interviews…" />
          ) : displayData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No interviews found.</div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10 shadow-sm">
                <tr>
                  <th
                    className="px-4 py-3 border-b border-slate-200 cursor-pointer select-none hover:text-blue-600 whitespace-nowrap"
                    onClick={() => cycleSort('candidate_name')}
                  >
                    Applicant <SortIcon field="candidate_name" sort={sort} />
                  </th>
                  <th className="px-4 py-3 border-b border-slate-200">Job Title</th>
                  <th className="px-4 py-3 border-b border-slate-200">Interviewer</th>
                  <th className="px-4 py-3 border-b border-slate-200">Round</th>
                  <th
                    className="px-4 py-3 border-b border-slate-200 cursor-pointer select-none hover:text-blue-600 whitespace-nowrap"
                    onClick={() => cycleSort('scheduled_at')}
                  >
                    Scheduled Date <SortIcon field="scheduled_at" sort={sort} />
                  </th>
                  <th className="px-4 py-3 border-b border-slate-200">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayData.map((iv) => {
                  const ds = computedDisplayStatus(iv);
                  const badge = STATUS_BADGE[ds] || STATUS_BADGE.SCHEDULED;
                  return (
                    <tr
                      key={iv.id}
                      onClick={() => setSelected(iv)}
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                    >
                      {/* Applicant — name clicks to profile, row clicks open panel */}
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col gap-1">
                          {/* Stop propagation so row click doesn't also trigger */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `/candidates/${iv.candidate_id}/profile`;
                            }}
                            className="font-semibold text-slate-800 hover:text-blue-600 hover:underline text-left w-fit"
                          >
                            {iv.candidate_name?.toUpperCase()}
                          </button>
                          <span className="text-slate-400 text-xs">{iv.candidate_email}</span>
                        </div>
                      </td>

                      {/* Job */}
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col">
                          <span className="text-slate-700 font-medium">{iv.job_title}</span>
                          <span className="text-slate-400 text-xs">{iv.job_code}</span>
                        </div>
                      </td>

                      {/* Interviewer */}
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                            {iv.interviewer_name?.[0]?.toUpperCase()}
                          </div>
                          <span className="text-xs">{iv.interviewer_name}</span>
                        </div>
                      </td>

                      {/* Round */}
                      <td className="px-4 py-4 align-top">
                        <span className="text-xs text-slate-600">
                          {ROUND_LABELS[iv.round_name] || iv.round_label}
                        </span>
                      </td>

                      {/* Scheduled date */}
                      <td className="px-4 py-4 align-top text-slate-500 text-xs whitespace-nowrap">
                        {formatSchedule(iv.scheduled_at, iv.end_time, iv.duration_minutes)}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-4 align-top">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {isCancelConfirm && selected && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[450px] max-w-[90vw] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Cancel Interview</h3>
              <button onClick={() => setIsCancelConfirm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Cancel the interview for <strong>{selected.candidate_name}</strong> — {selected.round_label}?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleCancel(selected.id)}
                className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded text-sm font-medium"
              >
                Yes, Cancel
              </button>
              <button
                onClick={() => setIsCancelConfirm(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded text-sm font-medium"
              >
                No, Keep It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Control Center Panel */}
      {selected && !isCancelConfirm && (
        <InterviewPanel
          interview={selected}
          allInterviews={data}
          onClose={() => setSelected(null)}
          onCancelRequest={() => { setIsCancelConfirm(true); }}
        />
      )}
    </div>
  );
}
