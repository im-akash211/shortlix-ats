import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Activity, User, Briefcase, MessageSquare, ArrowRightLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { activity as activityApi, users as usersApi } from '../../lib/api';

// ── Constants ──────────────────────────────────────────────────────────────────

const ACTION_OPTIONS = [
  { value: '',                           label: 'All Actions' },
  { value: 'stage_changed',              label: 'Stage Changed' },
  { value: 'candidate_rejected',         label: 'Candidate Rejected' },
  { value: 'candidate_moved_job',        label: 'Candidate Moved Job' },
  { value: 'interview_scheduled',        label: 'Interview Scheduled' },
  { value: 'interview_rescheduled',      label: 'Interview Rescheduled' },
  { value: 'interview_feedback_submitted', label: 'Feedback Submitted' },
  { value: 'round_result_set',           label: 'Round Result Set' },
  { value: 'job_created',               label: 'Job Created' },
  { value: 'job_updated',               label: 'Job Updated' },
];

const ENTITY_OPTIONS = [
  { value: '',           label: 'All Entities' },
  { value: 'candidate', label: 'Candidate' },
  { value: 'job',       label: 'Job' },
  { value: 'interview', label: 'Interview' },
];

const ENTITY_ICON = {
  candidate: User,
  job:       Briefcase,
  interview: MessageSquare,
};

const METADATA_LABELS = {
  candidate_name:  'Candidate',
  job_title:       'Job',
  from_stage:      'From Stage',
  to_stage:        'To Stage',
  round_label:     'Round',
  decision:        'Feedback Decision',
  overall_rating:  'Rating',
  scheduled_at:    'Scheduled At',
  previous_value:  'Changed From',
  new_value:       'Changed To',
  drop_reason:     'Drop Reason',
  old_job_title:   'Previous Job',
  new_job_title:   'New Job',
  round_result:    'Round Result',
  field_label:     'Field Updated',
  interviewer_name: 'Interviewer',
  hiring_manager_name: 'Hiring Manager',
  department:      'Department',
  job_code:        'Job Code',
};

// Fields to hide from the detail card (internal IDs, redundant)
const HIDDEN_KEYS = new Set([
  'candidate_id', 'job_id', 'interview_id', 'mapping_id',
  'old_job_id', 'new_job_id', 'round_name', 'field_name',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function formatMetaValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'scheduled_at') {
    try { return new Date(value).toLocaleString(); } catch { return value; }
  }
  if (key === 'overall_rating' && typeof value === 'number') return `${value}/5`;
  return String(value);
}

// ── Detail Card ───────────────────────────────────────────────────────────────

function DetailCard({ metadata }) {
  const entries = Object.entries(metadata).filter(([k]) => !HIDDEN_KEYS.has(k) && METADATA_LABELS[k]);

  if (!entries.length) return <p className="text-sm text-slate-400">No additional details.</p>;

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-2 py-3 px-4 bg-slate-50 rounded-lg border border-slate-200">
      {entries.map(([key, val]) => (
        <div key={key} className="flex flex-col">
          <span className="text-xs text-slate-400 uppercase tracking-wide">{METADATA_LABELS[key]}</span>
          <span className="text-sm text-slate-700 font-medium">{formatMetaValue(key, val)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Activity Row ──────────────────────────────────────────────────────────────

function ActivityRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ENTITY_ICON[log.entity_type] || Activity;

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left py-3 px-1 flex items-start gap-3 hover:bg-slate-50 transition-colors rounded"
      >
        <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800 leading-snug">{log.sentence}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {relativeTime(log.created_at)}
            {log.actor ? ` · ${log.actor.name}` : ''}
          </p>
        </div>
        <div className="flex-shrink-0 mt-0.5 text-slate-300">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="pb-3 px-10">
          <DetailCard metadata={log.metadata || {}} />
        </div>
      )}
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

function FilterBar({ filters, onChange, actorOptions }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value, page: 1 });

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-slate-500 whitespace-nowrap">From</label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={set('dateFrom')}
          className="border border-slate-200 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-slate-500 whitespace-nowrap">To</label>
        <input
          type="date"
          value={filters.dateTo}
          onChange={set('dateTo')}
          className="border border-slate-200 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <select
        value={filters.actor}
        onChange={set('actor')}
        className="border border-slate-200 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <option value="">All Users</option>
        {actorOptions.map((u) => (
          <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
        ))}
      </select>

      <select
        value={filters.action}
        onChange={set('action')}
        className="border border-slate-200 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        {ACTION_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        value={filters.entityType}
        onChange={set('entityType')}
        className="border border-slate-200 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        {ENTITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {(filters.dateFrom || filters.dateTo || filters.actor || filters.action || filters.entityType) && (
        <button
          onClick={() => onChange({ dateFrom: '', dateTo: '', actor: '', action: '', entityType: '', page: 1 })}
          className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 border border-blue-200 rounded"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

export default function ActivityMonitorSection() {
  const [filters, setFilters] = useState({
    dateFrom: '', dateTo: '', actor: '', action: '', entityType: '', page: 1,
  });

  const queryParams = useMemo(() => {
    const p = { page: filters.page, page_size: 20 };
    if (filters.dateFrom)    p.date_from   = filters.dateFrom;
    if (filters.dateTo)      p.date_to     = filters.dateTo;
    if (filters.actor)       p.actor       = filters.actor;
    if (filters.action)      p.action      = filters.action;
    if (filters.entityType)  p.entity_type = filters.entityType;
    return p;
  }, [filters]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['activity-log', queryParams],
    queryFn: () => activityApi.list(queryParams),
    placeholderData: (prev) => prev,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-dropdown-all'],
    queryFn: () => usersApi.list({ page_size: 200 }),
    staleTime: 5 * 60 * 1000,
  });

  const logs    = data?.results || [];
  const count   = data?.count   || 0;
  const page    = filters.page;
  const perPage = 20;
  const totalPages = Math.ceil(count / perPage);
  const from = Math.min((page - 1) * perPage + 1, count);
  const to   = Math.min(page * perPage, count);

  const actorOptions = useMemo(
    () => (Array.isArray(usersData) ? usersData : (usersData?.results || [])),
    [usersData]
  );

  return (
    <div>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        actorOptions={actorOptions}
      />

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Loading activity…</div>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center">
          <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No activity found for selected filters.</p>
        </div>
      ) : (
        <>
          <div className={`transition-opacity duration-150 ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
            {logs.map((log) => <ActivityRow key={log.id} log={log} />)}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                Showing {from}–{to} of {count}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                  className="px-3 py-1 text-sm border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                  className="px-3 py-1 text-sm border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
