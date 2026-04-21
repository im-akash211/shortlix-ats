import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../lib/useDebounce';
import { useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { PageLoader } from '../components/LoadingDots';
import { ROUTES } from '../routes/constants';
import {
  Search, MapPin, Clock, Eye, Mail, UserPlus, Users, ChevronDown, ChevronUp,
  User, X, Filter, Phone, Briefcase, Building2, ChevronRight, Edit2, BookOpen, Trash2, FileText, Share2, Download, Bell, BellRing, Trash,
} from 'lucide-react';
import {
  jobs as jobsApi,
  candidates as candidatesApi,
  interviews as interviewsApi,
  users as usersApi,
  candidateShare as candidateShareApi,
} from '../lib/api';
import { useAuth } from '../lib/authContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

const SOURCE_LABELS = {
  recruiter_upload: 'Recruiter Upload',
  naukri: 'Naukri',
  linkedin: 'LinkedIn',
  referral: 'Referral',
  manual: 'Manual',
};

const STAGE_LABELS = {
  APPLIED:     'Applied',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW:   'Interview',
  OFFERED:     'Offered',
  JOINED:      'Joined',
  DROPPED:     'Dropped',
};

const STAGE_COLORS = {
  APPLIED:     'bg-amber-100 text-amber-700',
  SHORTLISTED: 'bg-blue-100 text-blue-700',
  INTERVIEW:   'bg-purple-100 text-purple-700',
  OFFERED:     'bg-cyan-100 text-cyan-700',
  JOINED:      'bg-green-100 text-green-700',
  DROPPED:     'bg-rose-100 text-rose-700',
};

const STAGE_ORDER = { APPLIED: 0, SHORTLISTED: 1, INTERVIEW: 2, OFFERED: 3, JOINED: 4, DROPPED: 5 };

const ROUND_LABELS = { R1: 'R1', R2: 'R2', CLIENT: 'Client', CDO: 'CDO', MGMT: 'Mgmt' };
const ROUND_PROGRESSION = ['R1', 'R2', 'CLIENT', 'CDO', 'MGMT'];

const DROP_REASON_LABELS = {
  REJECTED: 'Rejected', CANDIDATE_DROP: 'Candidate Drop', NO_SHOW: 'No Show',
};
const OFFER_STATUS_LABELS = {
  OFFER_SENT: 'Offer Sent', OFFER_ACCEPTED: 'Offer Accepted', OFFER_DECLINED: 'Offer Declined',
};
const PRIORITY_COLORS = {
  HIGH: 'bg-red-100 text-red-700', MEDIUM: 'bg-amber-100 text-amber-700', LOW: 'bg-slate-100 text-slate-500',
};

function StatusBadge({ status }) {
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

function InfoRow({ label, children }) {
  return (
    <div className="flex py-3 border-b border-slate-100 last:border-0 gap-4">
      <span className="w-40 shrink-0 text-sm text-slate-500 font-medium">{label}</span>
      <div className="flex-1 text-sm text-slate-800 min-w-0">{children}</div>
    </div>
  );
}

function FilterAccordion({ title, options, selected, onToggle, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 text-sm">{title}</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 flex flex-col gap-2.5 max-h-[350px] overflow-y-auto scrollbar-thin">
          {options.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No options</p>
          ) : (
            options.map((opt) => (
              <label key={opt.id} className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-300 cursor-pointer accent-blue-600"
                  checked={selected.includes(opt.id)}
                  onChange={() => onToggle(opt.id)}
                />
                <span className="flex-1 leading-tight">{opt.label}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ReminderModal({ candidate, onClose, queryClient }) {
  const candidateId = candidate?.candidate;
  const [reminders, setReminders] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ remind_at: '', note: '' });

  React.useEffect(() => {
    if (!candidateId) return;
    candidatesApi.reminders(candidateId)
      .then(data => setReminders(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => setReminders([]))
      .finally(() => setLoading(false));
  }, [candidateId]);

  const handleAdd = async () => {
    if (!form.remind_at) return;
    setSaving(true);
    try {
      // Convert local datetime-local value to full ISO string (with UTC offset) so
      // Django's USE_TZ=True doesn't reject it as a naive datetime.
      const payload = { ...form, remind_at: new Date(form.remind_at).toISOString() };
      const created = await candidatesApi.addReminder(candidateId, payload);
      setReminders(prev => [...prev, created]);
      setForm({ remind_at: '', note: '' });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDone = async (r) => {
    const updated = await candidatesApi.updateReminder(candidateId, r.id, { is_done: !r.is_done });
    setReminders(prev => prev.map(x => x.id === r.id ? updated : x));
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const handleDelete = async (r) => {
    await candidatesApi.deleteReminder(candidateId, r.id);
    setReminders(prev => prev.filter(x => x.id !== r.id));
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const now    = new Date();
  const active = reminders.filter(r => !r.is_done);
  const done   = reminders.filter(r => r.is_done);
  const minDt  = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM

  const fmtRemindAt = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-semibold text-slate-800">Reminders</h2>
              <p className="text-xs text-slate-400">{candidate?.candidate_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] px-6 py-4 flex flex-col gap-5">
          {/* Add new */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Set a new reminder</p>
            <input
              type="datetime-local"
              min={minDt}
              value={form.remind_at}
              onChange={e => setForm(f => ({ ...f, remind_at: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <textarea
              rows={2}
              placeholder="Note (optional) — e.g. Notice period ends, follow up before offer"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
            <button
              onClick={handleAdd}
              disabled={!form.remind_at || saving}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Add Reminder'}
            </button>
          </div>

          {/* Active reminders */}
          {loading ? (
            <p className="text-xs text-slate-400 text-center py-2">Loading…</p>
          ) : active.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upcoming</p>
              {active.map(r => {
                const isOverdue = new Date(r.remind_at) < now;
                return (
                <div key={r.id} className={`flex items-start gap-3 p-3 rounded-lg border ${isOverdue ? 'border-red-200 bg-red-50' : 'border-amber-100 bg-amber-50'}`}>
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => handleToggleDone(r)}
                    className="mt-0.5 accent-amber-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${isOverdue ? 'text-red-600' : 'text-amber-700'}`}>
                      {isOverdue ? 'Overdue — ' : ''}{fmtRemindAt(r.remind_at)}
                    </p>
                    {r.note && <p className="text-xs text-slate-600 mt-0.5 break-words">{r.note}</p>}
                  </div>
                  <button onClick={() => handleDelete(r)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              );})}
            </div>
          )}

          {/* Done reminders */}
          {done.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Done</p>
              {done.map(r => (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 opacity-60">
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => handleToggleDone(r)}
                    className="mt-0.5 accent-slate-400 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-400 line-through">{fmtRemindAt(r.remind_at)}</p>
                    {r.note && <p className="text-xs text-slate-400 mt-0.5 line-through break-words">{r.note}</p>}
                  </div>
                  <button onClick={() => handleDelete(r)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && reminders.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-2">No reminders yet. Add one above.</p>
          )}
        </div>
      </div>
    </div>
  );
}

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

// ─── Stage tab map ────────────────────────────────────────────────────────────
// Each pipeline tab maps to a single macro stage key sent to the API.
const STAGE_TAB_MAP = {
  Applied:     'APPLIED',
  Shortlisted: 'SHORTLISTED',
  Interview:   'INTERVIEW',
  Offered:     'OFFERED',
  Joined:      'JOINED',
  Dropped:     'DROPPED',
};
const PIPELINE_TABS = ['Applied', 'Shortlisted', 'Interview', 'Offered', 'Joined', 'Dropped'];

// ─── Main component ───────────────────────────────────────────────────────────

export default function Jobs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── URL-based List state ───────────────────────────────────────────────────
  const activeTab = searchParams.get('tab') || 'All Jobs';
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const dateFrom  = searchParams.get('date_from') || '';
  const dateTo    = searchParams.get('date_to')   || '';
  const ordering  = searchParams.get('ordering')  || '-created_at';

  const setActiveTab = (val) => setSearchParams(p => { p.set('tab', val); return p; });
  const setSearch = (val) => setSearchParams(p => { if (val) p.set('search', val); else p.delete('search'); return p; });
  const setStatusFilter = (val) => setSearchParams(p => { p.set('status', val); return p; });
  const setDateFrom = (val) => setSearchParams(p => { if (val) p.set('date_from', val); else p.delete('date_from'); return p; });
  const setDateTo   = (val) => setSearchParams(p => { if (val) p.set('date_to',   val); else p.delete('date_to');   return p; });
  const setOrdering = (val) => setSearchParams(p => { p.set('ordering', val); return p; });

  const queryClient = useQueryClient();

  // Phase C debounce: local input state so typing is instant; URL (and fetch) only updates after 400ms pause
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 400);
  useEffect(() => {
    if (debouncedSearch !== search) setSearch(debouncedSearch);
  // intentionally omit `search` to avoid loop — this effect only syncs debounced → URL
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // ── URL-based Filter state — use stable primitives to avoid infinite loops ──
  // getAll() returns a new array each render; join to a string for stable deps.
  const filters = {
    department:     searchParams.getAll('department'),
    hiring_manager: searchParams.getAll('hiring_manager'),
    location:       searchParams.getAll('location'),
  };
  // Phase B: filter options fetched once, cached forever — they don't change during a session
  const { data: filterOptions = { departments: [], hiringManagers: [], locations: [] } } = useQuery({
    queryKey: ['jobs', 'filterOptions'],
    queryFn: () => jobsApi.list({ page_size: 100 }),
    staleTime: Infinity,
    select: (res) => {
      const all = res.results || res;
      const deptMap = {}, hmMap = {};
      const locSet = new Set();
      all.forEach((j) => {
        if (j.department && j.department_name) deptMap[j.department] = j.department_name;
        if (j.hiring_manager && j.hiring_manager_name) hmMap[j.hiring_manager] = j.hiring_manager_name;
        if (j.location) locSet.add(j.location);
      });
      return {
        departments:    Object.entries(deptMap).map(([id, label]) => ({ id, label })),
        hiringManagers: Object.entries(hmMap).map(([id, label]) => ({ id, label })),
        locations:      [...locSet].map((l) => ({ id: l, label: l })),
      };
    },
  });

  // ── Job detail state ─────────────────────────────────────────────────────────
  // ── Job detail state ─────────────────────────────────────────────────────────
  const detailMatch = useMatch(ROUTES.JOBS.DETAIL_PATTERN);
  const candidatesMatch = useMatch(ROUTES.JOBS.CANDIDATES_PATTERN);
  const interviewsMatch = useMatch(ROUTES.JOBS.INTERVIEWS_PATTERN);
  const matchJobId = detailMatch?.params?.jobId || candidatesMatch?.params?.jobId || interviewsMatch?.params?.jobId;

  const [viewingJob, setViewingJob]         = useState(null);
  const [jobDetail, setJobDetail]           = useState(null);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);
  const [pipelineTab, setPipelineTab]       = useState('Applied');
  const [pipeline, setPipeline]             = useState([]);
  const [pipelineStats, setPipelineStats]   = useState({});
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [isPipelinePanelOpen, setIsPipelinePanelOpen] = useState(false);

  // Use a stable boolean primitive to avoid new-object-reference re-renders
  const isCandidatesRoute = Boolean(candidatesMatch);

  // Sync route param with detail view
  useEffect(() => {
    if (matchJobId) {
      // Only fetch if we don't already have this job loaded
      if (!jobDetail || String(jobDetail.id) !== String(matchJobId)) {
        setJobDetailLoading(true);
        // matchJobId is a UUID string — do NOT convert to Number (would become NaN)
        jobsApi.detail(matchJobId)
          .then(data => {
            setJobDetail(data);
            setViewingJob(data);
          })
          .catch(console.error)
          .finally(() => setJobDetailLoading(false));
      }
      setIsPipelinePanelOpen(isCandidatesRoute);
    } else {
      setViewingJob(null);
      setJobDetail(null);
      setIsPipelinePanelOpen(false);
    }
  // jobDetail intentionally omitted — we only want to re-fetch on route change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchJobId, isCandidatesRoute]);

  // ── Edit modal state ─────────────────────────────────────────────────────────
  const [isEditOpen, setIsEditOpen]         = useState(false);
  const [editForm, setEditForm]             = useState({});
  const [editLoading, setEditLoading]       = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  // ── Delete job state ─────────────────────────────────────────────────────────
  const [isDeleteJobOpen, setIsDeleteJobOpen] = useState(false);
  const [deleteJobLoading, setDeleteJobLoading] = useState(false);

  // ── Collaborators modal state ────────────────────────────────────────────────
  const [isCollabModalOpen, setIsCollabModalOpen]       = useState(false);
  const [selectedJob, setSelectedJob]                   = useState(null);
  const [collabList, setCollabList]                     = useState([]);
  const [collabLoading, setCollabLoading]               = useState(false);
  const [collabEmail, setCollabEmail]                   = useState('');
  const [collabSearchResults, setCollabSearchResults]   = useState([]);
  const [collabSearchLoading, setCollabSearchLoading]   = useState(false);
  const [collabActionLoading, setCollabActionLoading]   = useState(false);
  const [collabError, setCollabError]                   = useState('');
  const [recruiterUsers, setRecruiterUsers]             = useState([]);
  const [collabFilter, setCollabFilter]                 = useState('');
  const [collabInputFocused, setCollabInputFocused]     = useState(false);
  const [collabSuccess, setCollabSuccess]               = useState('');

  // ── Add Profile modal state ──────────────────────────────────────────────────
  const [isAddProfileOpen, setIsAddProfileOpen] = useState(false);
  const [addProfileTargetJob, setAddProfileTargetJob] = useState(null);
  const [addForm, setAddForm] = useState({ full_name: '', email: '', phone: '', location: '', total_experience_years: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addProfileSuccess, setAddProfileSuccess] = useState('');

  // ── Shortlist action state ────────────────────────────────────────────────────
  const [shortlistingId, setShortlistingId] = useState(null);

  // ── Interview round action state ─────────────────────────────────────────────
  const [nextRoundLoading, setNextRoundLoading] = useState(null); // mapping id
  const [jumpRoundLoading, setJumpRoundLoading] = useState(null); // mapping id

  // ── Drop candidate modal state ───────────────────────────────────────────────
  const [dropModalCandidate, setDropModalCandidate] = useState(null);
  const [dropReason, setDropReason]               = useState('REJECTED');
  const [dropLoading, setDropLoading]             = useState(false);

  const openCandidateProfile = (c) => {
    navigate(ROUTES.JOBS.CANDIDATE_PROFILE(viewingJob.id, c.candidate));
  };

  // ── Resume viewer state ──────────────────────────────────────────────────────
  const [resumeModal, setResumeModal] = useState(null);
  const openResume = async (candidate) => {
    try {
      const files = candidate.resume_files || [];
      const latest = files.find(f => f.is_latest) || files[0];
      if (files.length === 0) { setResumeModal({ name: candidate.full_name, empty: true }); return; }
      if (!latest?.file_url) { setResumeModal({ name: candidate.full_name, missing: true }); return; }
      setResumeModal({ url: latest.file_url, filename: latest.original_filename, type: latest.file_type, name: candidate.full_name });
    } catch (err) {
      setResumeModal({ name: candidate.full_name, error: true });
    }
  };

  // ── Schedule Interview modal state ───────────────────────────────────────────
  const [isScheduleOpen, setIsScheduleOpen]         = useState(false);
  const [scheduleCandidate, setScheduleCandidate]   = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    round_number: 1, round_label: '', interviewer: '',
    scheduled_at: '', duration_minutes: 60, mode: 'virtual', meeting_link: '',
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [usersList, setUsersList]             = useState([]);
  const [usersLoading, setUsersLoading]       = useState(false);
  const [scheduleToast, setScheduleToast]     = useState(null);
  const [shareToast, setShareToast]           = useState(null);

  // ── Share candidate state ────────────────────────────────────────────────────
  const [shareOpen, setShareOpen]           = useState(null); // candidate id
  const [shareSearch, setShareSearch]       = useState('');
  const [shareSelected, setShareSelected]   = useState([]);
  const shareRef                            = useRef(null);

  // ── Reminder state ────────────────────────────────────────────────────────────
  const [reminderCandidate, setReminderCandidate] = useState(null); // mapping object
  useEffect(() => {
    if (!shareOpen) return;
    // load users if not already loaded
    if (usersList.length === 0) {
      setUsersLoading(true);
      usersApi.dropdown()
        .then((res) => setUsersList(Array.isArray(res) ? res : (res.results || [])))
        .catch(console.error)
        .finally(() => setUsersLoading(false));
    }
    const handler = (e) => { if (shareRef.current && !shareRef.current.contains(e.target)) { setShareOpen(null); setShareSearch(''); setShareSelected([]); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareOpen]);

  // Filter options now handled by React Query above (see filterOptions useQuery)

  // ── Toggle filter (multi-select per group) ───────────────────────────────────
  const toggleFilter = (key, id) => {
    setSearchParams(prev => {
      const current = prev.getAll(key);
      prev.delete(key);
      if (current.includes(id)) {
        current.filter(v => v !== id).forEach(v => prev.append(key, v));
      } else {
        [...current, id].forEach(v => prev.append(key, v));
      }
      return prev;
    });
  };

  const clearFilters = () => {
    setSearchParams(prev => {
      prev.delete('department');
      prev.delete('hiring_manager');
      prev.delete('location');
      prev.delete('date_from');
      prev.delete('date_to');
      return prev;
    });
  };

  const activeFilterCount =
    filters.department.length +
    filters.hiring_manager.length +
    filters.location.length +
    (dateFrom || dateTo ? 1 : 0);

  // ── Phase B+C: jobs list — cached per filter combination; previous data shown while new results load ──
  const jobsQueryKey = ['jobs', 'list', { tab: activeTab, status: statusFilter, search, dept: filters.department, hm: filters.hiring_manager, loc: filters.location, dateFrom, dateTo, ordering }];
  const { data: jobsQueryData, isLoading: loading } = useQuery({
    queryKey: jobsQueryKey,
    queryFn: () => {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (activeTab === 'My Jobs') params.tab = 'mine';
      if (search)                          params.search         = search;
      if (filters.department.length > 0)   params.department     = filters.department.join(',');
      if (filters.hiring_manager.length > 0) params.hiring_manager = filters.hiring_manager.join(',');
      if (filters.location.length > 0)     params.location       = filters.location.join(',');
      if (dateFrom)                        params.date_from      = dateFrom;
      if (dateTo)                          params.date_to        = dateTo;
      params.ordering = ordering;
      return jobsApi.list(params);
    },
    placeholderData: (previousData) => previousData,
  });

  const jobsList = jobsQueryData ? (jobsQueryData.results || jobsQueryData) : [];
  const total    = jobsQueryData?.count ?? jobsList.length;

  // ── Open job detail ──────────────────────────────────────────────────────────
  // ── Open job detail ──────────────────────────────────────────────────────────
  const openJobDetails = (job, tab = 'Applied', openPanel = false) => {
    // Set viewingJob immediately so the detail view renders at once (optimistic)
    setViewingJob(job);
    setPipelineTab(tab);
    if (openPanel || tab !== 'Applied') {
      navigate(ROUTES.JOBS.CANDIDATES(job.id));
    } else {
      navigate(ROUTES.JOBS.DETAIL(job.id));
    }
  };

  // ── Pipeline stats — always load when a job is opened (powers the tiles) ────
  useEffect(() => {
    if (!viewingJob) return;
    jobsApi.pipelineStats(viewingJob.id)
      .then(setPipelineStats)
      .catch(console.error);
  }, [viewingJob]);

  // ── Pipeline candidates — only load when the panel is open ──────────────────
  const refreshPipeline = (jobId, tab) => {
    const stage = STAGE_TAB_MAP[tab];
    const params = { include_progressed: 'true' };
    if (stage) params.stage = stage;
    return jobsApi.pipeline(jobId, params)
      .then((res) => setPipeline(Array.isArray(res) ? res : (res.results || [])))
      .catch(console.error);
  };

  useEffect(() => {
    if (!viewingJob || !isPipelinePanelOpen) return;
    setPipelineLoading(true);
    refreshPipeline(viewingJob.id, pipelineTab).finally(() => setPipelineLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingJob, pipelineTab, isPipelinePanelOpen]);

  // ── Edit handlers ────────────────────────────────────────────────────────────
  const openEdit = () => {
    if (!jobDetail) return;
    setEditForm({
      title:            jobDetail.title || '',
      location:         jobDetail.location || '',
      status:           jobDetail.status || 'open',
      experience_min:   jobDetail.experience_min ?? 0,
      experience_max:   jobDetail.experience_max ?? 0,
      skills_required:  (jobDetail.skills_required || []).join(', '),
      job_description:  jobDetail.job_description || '',
    });
    setIsEditOpen(true);
  };

  const handleEditSave = async () => {
    setEditLoading(true);
    try {
      const updated = await jobsApi.update(jobDetail.id, {
        ...editForm,
        skills_required: editForm.skills_required.split(',').map((s) => s.trim()).filter(Boolean),
        experience_min:  Number(editForm.experience_min),
        experience_max:  Number(editForm.experience_max),
      });
      setJobDetail(updated);
      setViewingJob((prev) => ({ ...prev, title: updated.title, location: updated.location, status: updated.status }));
      setIsEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['jobs', 'list'] });
    } catch (err) {
      alert(err.data?.detail || JSON.stringify(err.data) || 'Failed to save changes');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Delete job handler ───────────────────────────────────────────────────────
  const handleDeleteJob = async () => {
    if (!jobDetail) return;
    setDeleteJobLoading(true);
    try {
      await jobsApi.delete(jobDetail.id);
      setIsDeleteJobOpen(false);
      setViewingJob(null);
      setJobDetail(null);
      queryClient.invalidateQueries({ queryKey: ['jobs', 'list'] });
    } catch (err) {
      alert(err.data?.detail || 'Failed to delete job');
    } finally {
      setDeleteJobLoading(false);
    }
  };

  // ── Collaborator helpers ─────────────────────────────────────────────────────
  const openCollabModal = (job) => {
    setSelectedJob(job);
    setCollabError('');
    setCollabSuccess('');
    setCollabEmail('');
    setCollabFilter('');
    setCollabInputFocused(false);
    setCollabSearchResults([]);
    setIsCollabModalOpen(true);
    fetchCollaborators(job.id);
    // Load all recruiter-role users for the add-collaborator list
    usersApi.list({ role: 'recruiter' })
      .then((res) => setRecruiterUsers(res.results || res))
      .catch(console.error);
  };

  const fetchCollaborators = (jobId) => {
    setCollabLoading(true);
    jobsApi.listCollaborators(jobId)
      .then((res) => setCollabList(res.results || res))
      .catch(console.error)
      .finally(() => setCollabLoading(false));
  };

  const handleCollabSearch = () => {
    if (!collabEmail.trim()) return;
    setCollabSearchLoading(true);
    setCollabError('');
    usersApi.lookup({ email: collabEmail.trim() })
      .then((res) => setCollabSearchResults(res.results || res))
      .catch(console.error)
      .finally(() => setCollabSearchLoading(false));
  };

  const handleAddCollab = async (userId) => {
    setCollabActionLoading(true);
    setCollabError('');
    setCollabSuccess('');
    try {
      await jobsApi.addCollaborator(selectedJob.id, userId);
      setCollabSearchResults([]);
      setCollabEmail('');
      setCollabFilter('');
      fetchCollaborators(selectedJob.id);
      // Refresh detail collaborators list if viewing that job
      if (viewingJob?.id === selectedJob.id) {
        jobsApi.detail(selectedJob.id).then(setJobDetail).catch(console.error);
      }
      setCollabSuccess('Collaborator added successfully.');
      setTimeout(() => setCollabSuccess(''), 3000);
    } catch (err) {
      setCollabError(err.data?.non_field_errors?.[0] || err.data?.detail || 'Could not add collaborator.');
    } finally {
      setCollabActionLoading(false);
    }
  };

  const handleRemoveCollab = async (userId) => {
    setCollabActionLoading(true);
    setCollabError('');
    try {
      await jobsApi.removeCollaborator(selectedJob.id, userId);
      fetchCollaborators(selectedJob.id);
      if (viewingJob?.id === selectedJob.id) {
        jobsApi.detail(selectedJob.id).then(setJobDetail).catch(console.error);
      }
    } catch (err) {
      setCollabError(err.data?.detail || 'Could not remove collaborator.');
    } finally {
      setCollabActionLoading(false);
    }
  };

  // ── Add Profile ──────────────────────────────────────────────────────────────
  const handleAddProfile = async () => {
    if (!addForm.full_name || !addForm.email) return;
    setAddLoading(true);
    const targetJob = addProfileTargetJob || viewingJob;
    try {
      const candidate = await candidatesApi.create({
        ...addForm,
        total_experience_years: addForm.total_experience_years || null,
        source: 'manual',
      });
      if (targetJob) await candidatesApi.assignJob(candidate.id, targetJob.id);
      setIsAddProfileOpen(false);
      setAddProfileTargetJob(null);
      setAddForm({ full_name: '', email: '', phone: '', location: '', total_experience_years: '' });
      if (viewingJob && targetJob?.id === viewingJob.id) {
        setPipelineTab('Applied');
        setIsPipelinePanelOpen(true);
        // Refresh stats
        jobsApi.pipelineStats(viewingJob.id).then(setPipelineStats).catch(console.error);
      }
      // Show success toast
      setAddProfileSuccess(`Profile added successfully${targetJob ? ` to ${targetJob.title}` : ''}.`);
      setTimeout(() => setAddProfileSuccess(''), 4000);
    } catch (err) {
      alert(err.data?.email?.[0] || err.data?.detail || 'Failed to add profile');
    } finally {
      setAddLoading(false);
    }
  };

  // ── Schedule Interview ───────────────────────────────────────────────────────
  const closeScheduleModal = () => {
    setIsScheduleOpen(false);
    setScheduleCandidate(null);
    setScheduleForm({ round_number: 1, round_label: '', interviewer: '', scheduled_at: '', duration_minutes: 60, mode: 'virtual', meeting_link: '' });
    setScheduleToast(null);
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleForm.interviewer || !scheduleForm.scheduled_at) return;
    setScheduleLoading(true);
    setScheduleToast(null);
    try {
      await interviewsApi.create({
        mapping:          scheduleCandidate.id,
        round_number:     Number(scheduleForm.round_number),
        round_label:      scheduleForm.round_label,
        interviewer:      scheduleForm.interviewer,
        scheduled_at:     new Date(scheduleForm.scheduled_at).toISOString(),
        duration_minutes: Number(scheduleForm.duration_minutes),
        mode:             scheduleForm.mode,
        meeting_link:     scheduleForm.meeting_link,
      });
      setScheduleToast({ type: 'success', message: 'Interview scheduled successfully.' });
      setTimeout(() => closeScheduleModal(), 1200);
    } catch (err) {
      setScheduleToast({ type: 'error', message: err.data?.detail || JSON.stringify(err.data) || 'Failed to schedule.' });
    } finally {
      setScheduleLoading(false);
    }
  };

  // ── Stage change helpers ─────────────────────────────────────────────────────
  const doStageChange = async (c, payload) => {
    await candidatesApi.changeStage(c.candidate, c.job, payload);
    await Promise.all([
      refreshPipeline(viewingJob.id, pipelineTab),
      jobsApi.pipelineStats(viewingJob.id).then(setPipelineStats).catch(console.error),
    ]);
  };

  const handleShortlist = async (c) => {
    setShortlistingId(c.id);
    try {
      await doStageChange(c, { macro_stage: 'SHORTLISTED' });
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to shortlist candidate');
    } finally {
      setShortlistingId(null);
    }
  };

  const handleMoveToInterview = async (c) => {
    setShortlistingId(c.id);
    try {
      await doStageChange(c, { macro_stage: 'INTERVIEW' });
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to move to interview');
    } finally {
      setShortlistingId(null);
    }
  };

  const handleMakeOffer = async (c) => {
    setShortlistingId(c.id);
    try {
      await doStageChange(c, { macro_stage: 'OFFERED', offer_status: 'OFFER_SENT' });
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to make offer');
    } finally {
      setShortlistingId(null);
    }
  };

  const handleMarkJoined = async (c) => {
    setShortlistingId(c.id);
    try {
      await doStageChange(c, { macro_stage: 'JOINED' });
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to mark as joined');
    } finally {
      setShortlistingId(null);
    }
  };

  const handleDropConfirm = async () => {
    if (!dropModalCandidate) return;
    setDropLoading(true);
    try {
      await doStageChange(dropModalCandidate, { macro_stage: 'DROPPED', drop_reason: dropReason });
      setDropModalCandidate(null);
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to drop candidate');
    } finally {
      setDropLoading(false);
    }
  };

  const handleNextRound = async (c) => {
    setNextRoundLoading(c.id);
    try {
      await candidatesApi.nextRound(c.candidate, c.job);
      await refreshPipeline(viewingJob.id, pipelineTab);
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to advance round');
    } finally {
      setNextRoundLoading(null);
    }
  };

  const handleJumpRound = async (c, roundName) => {
    setJumpRoundLoading(c.id);
    try {
      await candidatesApi.jumpToRound(c.candidate, c.job, roundName);
      await refreshPipeline(viewingJob.id, pipelineTab);
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to jump round');
    } finally {
      setJumpRoundLoading(null);
    }
  };

  // ── Pipeline stat helpers ────────────────────────────────────────────────────
  const getStatCount = (tab) => {
    if (!pipelineStats) return 0;
    const key = tab.toLowerCase();
    return pipelineStats[key] || 0;
  };

  // ── Candidate card ───────────────────────────────────────────────────────────
  const renderCandidateCard = (c) => {
    const isActive = c.is_current_stage !== false;
    const macroStage = c.macro_stage;
    const isShareOpen = shareOpen === c.id;
    const filteredUsers = usersList.filter(u =>
      u.full_name.toLowerCase().includes(shareSearch.toLowerCase())
    );

    // Build progress indicator: first + prev + current (max 3 stages)
    const stageOrder = ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'JOINED'];
    const progressStages = (() => {
      if (macroStage === 'DROPPED') return [{ stage: 'DROPPED', isCurrent: true }];
      const idx = stageOrder.indexOf(macroStage);
      if (idx < 0) return [{ stage: macroStage, isCurrent: true }];
      if (idx === 0) return [{ stage: stageOrder[0], isCurrent: true }];
      if (idx === 1) return [
        { stage: stageOrder[0], isCurrent: false },
        { stage: stageOrder[1], isCurrent: true },
      ];
      return [
        { stage: stageOrder[0], isCurrent: false },
        { stage: stageOrder[idx - 1], isCurrent: false },
        { stage: stageOrder[idx], isCurrent: true },
      ];
    })();

    return (
      <div key={c.id}>
        {/* Card */}
        <div
          onClick={() => isActive && openCandidateProfile(c)}
          className={`border rounded-xl p-4 ${isActive ? 'bg-white hover:shadow-md transition-shadow border-slate-200 cursor-pointer' : 'bg-slate-50 opacity-50 border-slate-100'}`}
        >

          {/* TOP: avatar + name + round pill + stage badge + share */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                {c.candidate_name ? c.candidate_name.slice(0, 2).toUpperCase() : '?'}
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold text-slate-800 leading-tight block truncate max-w-[160px]">
                  {c.candidate_name}
                </span>
                {macroStage === 'INTERVIEW' && c.current_interview_round && (
                  <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                    {ROUND_LABELS[c.current_interview_round] || c.current_interview_round}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STAGE_COLORS[macroStage] || 'bg-slate-100 text-slate-600'}`}>
                {STAGE_LABELS[macroStage] || macroStage}
              </span>
              {isActive && (
                <button
                  onClick={(e) => { e.stopPropagation(); setReminderCandidate(c); }}
                  className="relative text-slate-400 hover:text-amber-500 transition-colors p-1"
                  title="Set reminder"
                >
                  <Bell className="w-3 h-3" />
                  {c.has_active_reminder && (
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  )}
                </button>
              )}
              {isActive && (
                <div className="relative" ref={isShareOpen ? shareRef : null}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShareOpen(isShareOpen ? null : c.id); setShareSearch(''); setShareSelected([]); }}
                    className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                    title="Share"
                  >
                    <Share2 className="w-3 h-3" />
                  </button>
                  {isShareOpen && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-[300] flex flex-col overflow-hidden">
                      <div className="p-2 border-b border-slate-100">
                        <input autoFocus type="text" placeholder="Search users..." value={shareSearch}
                          onChange={(e) => setShareSearch(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
                      </div>
                      <div className="overflow-y-auto max-h-48">
                        {usersLoading ? (
                          <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
                            <svg className="animate-spin w-4 h-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                            <span className="text-xs">Loading...</span>
                          </div>
                        ) : filteredUsers.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-3">No users found</p>
                        ) : filteredUsers.map((u) => (
                          <label key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={shareSelected.includes(u.id)}
                              onChange={() => setShareSelected(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                              className="accent-blue-600" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-800 truncate">{u.full_name}</p>
                              <p className="text-[10px] text-slate-400 truncate capitalize">{u.role?.replace('_', ' ')}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="p-2 border-t border-slate-100">
                        <button disabled={shareSelected.length === 0}
                          onClick={async () => {
                            const count = shareSelected.length;
                            try {
                              await candidateShareApi.share(c.candidate, shareSelected);
                              setShareToast(`Profile shared with ${count} user${count > 1 ? 's' : ''} successfully`);
                              setTimeout(() => setShareToast(null), 3000);
                            } catch (err) { console.error('Share failed', err); }
                            setShareOpen(null); setShareSearch(''); setShareSelected([]);
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded-lg transition-colors">
                          Share{shareSelected.length > 0 ? ` (${shareSelected.length})` : ''}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Progress indicator: ○ first → ○ prev → ● current */}
          <div className="flex items-center gap-1 mb-2.5">
            {progressStages.map((ps, idx) => (
              <React.Fragment key={ps.stage}>
                {idx > 0 && <span className="text-[9px] text-slate-400">→</span>}
                <span className={`text-[10px] flex items-center gap-0.5 ${ps.isCurrent ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
                  <span>{ps.isCurrent ? '●' : '○'}</span>
                  <span>{STAGE_LABELS[ps.stage] || ps.stage}</span>
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* MIDDLE: exp | skills (max 3) | location */}
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            {c.candidate_experience != null && (
              <span className="text-xs text-slate-500 flex items-center gap-0.5">
                <Briefcase className="w-3 h-3" /> {c.candidate_experience} yrs
              </span>
            )}
            {c.candidate_skills?.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {c.candidate_skills.slice(0, 3).map((s, i) => (
                  <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{s}</span>
                ))}
              </div>
            )}
            {c.candidate_location && (
              <span className="text-xs text-slate-500 flex items-center gap-0.5 ml-auto">
                <MapPin className="w-3 h-3" /> {c.candidate_location}
              </span>
            )}
          </div>

          {/* BOTTOM: stage metadata + priority + action buttons */}
          <div className="flex flex-col gap-1">
            {/* Row 1: stage-specific info */}
            <div className="flex items-center gap-2 flex-wrap min-h-[16px]">
              {macroStage === 'INTERVIEW' && c.latest_round && (
                <span className="text-xs text-slate-500">
                  {ROUND_LABELS[c.latest_round.round_name] || c.latest_round.round_name}
                  {c.latest_round.round_status && <span className="text-slate-400"> · {c.latest_round.round_status}</span>}
                </span>
              )}
              {macroStage === 'OFFERED' && c.offer_status && (
                <span className="text-xs text-slate-500">{OFFER_STATUS_LABELS[c.offer_status] || c.offer_status}</span>
              )}
              {macroStage === 'DROPPED' && c.drop_reason && (
                <span className="text-xs text-rose-600 font-medium">{DROP_REASON_LABELS[c.drop_reason] || c.drop_reason}</span>
              )}
              {['APPLIED', 'SHORTLISTED'].includes(macroStage) && c.stage_updated_at && (
                <span className="text-xs text-slate-400">
                  Updated {new Date(c.stage_updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
            {/* Row 2: priority badge + action buttons */}
            {isActive && (
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.MEDIUM}`}>
                  {c.priority || 'MEDIUM'}
                </span>
                <div className="flex items-center gap-1.5">
                  {macroStage === 'APPLIED' && (
                    <button onClick={(e) => { e.stopPropagation(); handleShortlist(c); }} disabled={shortlistingId === c.id}
                      className="text-[10px] font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors">
                      {shortlistingId === c.id ? '…' : 'Shortlist'}
                    </button>
                  )}
                  {macroStage === 'SHORTLISTED' && (
                    <button onClick={(e) => { e.stopPropagation(); handleMoveToInterview(c); }} disabled={shortlistingId === c.id}
                      className="text-[10px] font-medium bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors">
                      {shortlistingId === c.id ? '…' : '→ Interview'}
                    </button>
                  )}
                  {macroStage === 'OFFERED' && (
                    <button onClick={(e) => { e.stopPropagation(); handleMarkJoined(c); }} disabled={shortlistingId === c.id}
                      className="text-[10px] font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors">
                      {shortlistingId === c.id ? '…' : '✓ Joined'}
                    </button>
                  )}
                  {!['JOINED', 'DROPPED'].includes(macroStage) && (
                    <button onClick={(e) => { e.stopPropagation(); setDropModalCandidate(c); setDropReason('REJECTED'); }}
                      className="text-[10px] font-medium bg-rose-50 hover:bg-rose-100 text-rose-600 px-2 py-1 rounded transition-colors border border-rose-200">
                      Drop
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Interview action bar — only active INTERVIEW cards */}
        {isActive && macroStage === 'INTERVIEW' && (
          <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg">
            <button
              onClick={() => handleNextRound(c)}
              disabled={nextRoundLoading === c.id || c.current_interview_round === 'MGMT' || !c.can_move_next}
              className="text-xs font-medium bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors"
            >
              {nextRoundLoading === c.id ? 'Advancing…' : 'Next Round'}
            </button>
            <select
              disabled={jumpRoundLoading === c.id}
              onChange={(e) => { if (e.target.value) { handleJumpRound(c, e.target.value); e.target.value = ''; } }}
              defaultValue=""
              className="text-xs border border-purple-200 rounded px-2 py-1.5 bg-white outline-none focus:border-purple-400 disabled:opacity-40"
            >
              <option value="" disabled>Jump to round…</option>
              {ROUND_PROGRESSION.map((r) => (
                <option key={r} value={r} disabled={r === c.current_interview_round}>
                  {ROUND_LABELS[r]}{r === c.current_interview_round ? ' (current)' : ''}
                </option>
              ))}
            </select>
            {c.can_move_next && (
              <button
                onClick={() => handleMakeOffer(c)}
                disabled={shortlistingId === c.id}
                className="text-xs font-medium ml-auto bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors"
              >
                {shortlistingId === c.id ? '…' : 'Make Offer'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ══════════ RESUME VIEWER MODAL ══════════ */}
      <Modal isOpen={!!resumeModal} onClose={() => setResumeModal(null)} title={resumeModal ? `Resume — ${resumeModal.name}` : ''} maxWidth="max-w-4xl">
        {resumeModal && (
          resumeModal.error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
              <FileText className="w-16 h-16 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Failed to load resume.</p>
            </div>
          ) : resumeModal.empty ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
              <FileText className="w-16 h-16 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No resume uploaded</p>
              <p className="text-xs text-slate-400">This candidate does not have a resume on file.</p>
            </div>
          ) : resumeModal.missing ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
              <FileText className="w-16 h-16 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Resume file not found</p>
              <p className="text-xs text-slate-400">The file may have been deleted. Please upload a new resume.</p>
            </div>
          ) : resumeModal.type === 'pdf' ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{resumeModal.filename}</span>
                <a href={resumeModal.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Open in new tab</a>
              </div>
              <iframe src={resumeModal.url} className="w-full rounded-lg border border-slate-200" style={{ height: '70vh' }} title="Resume" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-slate-500">
              <FileText className="w-16 h-16 text-slate-300" />
              <p className="text-sm text-slate-600">Preview not available for .docx files.</p>
              <a href={resumeModal.url} target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Download Resume
              </a>
            </div>
          )
        )}
      </Modal>

      {/* ══════════════════ JOB DETAIL VIEW ══════════════════ */}
      {/* Show detail container immediately when URL matches a job ID — avoids listing flash on refresh */}
      {(viewingJob || matchJobId) ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

          {/* Header bar */}
          <div className="flex items-start justify-between mb-4 shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => navigate(ROUTES.JOBS.ROOT)}
                className="text-slate-500 hover:text-slate-800 text-sm transition-colors shrink-0"
              >
                ← Back
              </button>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-500 shrink-0">Manage Jobs</span>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm font-semibold text-slate-800 truncate">View Job</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={openEdit}
                disabled={!jobDetail}
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-sm"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => setIsDeleteJobOpen(true)}
                disabled={!jobDetail}
                className="flex items-center gap-1.5 bg-white border border-rose-200 text-rose-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-rose-50 disabled:opacity-40 transition-colors shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button
                onClick={() => viewingJob && openCollabModal(viewingJob)}
                disabled={!viewingJob}
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-sm"
              >
                <Users className="w-3.5 h-3.5" /> Collaborators
              </button>
              <button
                disabled={!viewingJob}
                onClick={async () => {
                  if (!viewingJob) return;
                  const url = jobsApi.reportExcelUrl(viewingJob.id);
                  const token = localStorage.getItem('access');
                  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                  const blob = await res.blob();
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = `${viewingJob.job_code}_${viewingJob.title}_Report.xlsx`;
                  link.click();
                  URL.revokeObjectURL(link.href);
                }}
                className="flex items-center gap-1.5 bg-white border border-emerald-300 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-50 disabled:opacity-40 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> Report
              </button>
              <button
                onClick={() => setIsAddProfileOpen(true)}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add Profile
              </button>
            </div>
          </div>

          {/* ── Two-column content area ── */}
          <div className="flex gap-5 flex-1 min-h-0">

            {/* LEFT: Job info card — independently scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 pr-2 pb-4">

              {/* Job Info Card - Structuring this as a flex container to allow its body to scroll independently if it hits the screen limit */}
              {jobDetailLoading ? (
                <div className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse space-y-3">
                  <div className="h-6 bg-slate-100 rounded w-2/3" />
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  {[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-slate-100 rounded" />)}
                </div>
              ) : jobDetail ? (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full max-h-full">
                  {/* Card header */}
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-slate-800">
                          {jobDetail.title}
                        </h2>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-sm text-slate-500">
                            <MapPin className="w-3.5 h-3.5" /> {jobDetail.location}
                          </span>
                          <StatusBadge status={jobDetail.status} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details table container - Ensure this section can scroll independently within the card if needed */}
                  <div className="flex-1 min-h-0 overflow-y-auto px-6 py-1 border-t border-slate-100">
                    <div className="py-2">
                      <InfoRow label="Job Code">{jobDetail.job_code}</InfoRow>
                      <InfoRow label="Job Title">{jobDetail.title}</InfoRow>
                      <InfoRow label="Department">{jobDetail.department_name || '—'}</InfoRow>
                      <InfoRow label="Hiring Manager">{jobDetail.hiring_manager_name || '—'}</InfoRow>
                      <InfoRow label="Location">{jobDetail.location || '—'}</InfoRow>
                      <InfoRow label="Experience">
                        {(jobDetail.experience_min > 0 || jobDetail.experience_max > 0)
                          ? `${jobDetail.experience_min} – ${jobDetail.experience_max} years`
                          : '—'}
                      </InfoRow>
                      <InfoRow label="Status"><StatusBadge status={jobDetail.status} /></InfoRow>

                      <InfoRow label="TAT">
                        {jobDetail.tat_days != null ? `${jobDetail.tat_days} days` : 'N/A'}
                      </InfoRow>

                      {(user?.role === 'admin' || user?.role === 'recruiter') && (
                        <InfoRow label="Budget">
                          {jobDetail.budget != null ? `₹${jobDetail.budget} L` : 'N/A'}
                        </InfoRow>
                      )}

                      <InfoRow label="Recruiter">
                        {jobDetail.recruiters_working?.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {jobDetail.recruiters_working.map((r) => (
                              <span key={r.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                                {r.name}
                              </span>
                            ))}
                          </div>
                        ) : 'N/A'}
                      </InfoRow>

                      {jobDetail.skills_required?.length > 0 && (
                        <div className="py-4 border-b border-slate-100 last:border-0">
                          <span className="block text-sm text-slate-500 font-medium mb-2">Required Skills</span>
                          <div className="flex flex-wrap gap-2">
                            {jobDetail.skills_required.map((s, i) => (
                              <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {jobDetail.job_description && (
                        <div className="py-4 last:border-0">
                          <span className="block text-sm text-slate-500 font-medium mb-2">Job Description</span>
                          <div
                            className="text-sm text-slate-700 leading-relaxed [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mb-1 [&_strong]:font-semibold"
                            dangerouslySetInnerHTML={{ __html: jobDetail.job_description }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

            </div>

            {/* RIGHT: Stats + Actions + Collaborators + History — independently scrollable */}
            <div className="w-72 shrink-0 min-h-0 overflow-y-auto flex flex-col gap-4 pb-4">

              {/* Pipeline overview tiles */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pipeline Overview</p>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {jobDetail?.view_count || 0} views
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Applied',     tab: 'Applied' },
                    { label: 'Shortlisted', tab: 'Shortlisted' },
                    { label: 'Interview',   tab: 'Interview' },
                    { label: 'Offered',     tab: 'Offered' },
                    { label: 'Joined',      tab: 'Joined' },
                    { label: 'Dropped',     tab: 'Dropped' },
                  ].map(({ label, tab }) => (
                    <button
                      key={tab}
                      onClick={() => { setPipelineTab(tab); navigate(ROUTES.JOBS.CANDIDATES(viewingJob.id)); }}
                      className="flex flex-col items-center p-2 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <span className="text-2xl font-bold text-slate-700">{getStatCount(tab)}</span>
                      <span className="text-xs font-medium text-blue-600">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Collaborators list */}
              {jobDetail?.collaborators?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Collaborators ({jobDetail.collaborators.length})
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {jobDetail.collaborators.map((c) => (
                      <div key={c.id} className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {c.user_name ? c.user_name.slice(0, 2).toUpperCase() : '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{c.user_name}</p>
                          <p className="text-xs text-slate-500 truncate">{c.user_email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity Log — always shows creation at top, then changes oldest→newest */}
              {jobDetail && (() => {
                // 1. Creation entry — always pinned at top, sourced from jobDetail directly
                const creationEntry = {
                  id: '__created__',
                  event_type: 'job_created',
                  description: `Job Created`,
                  changed_by_name: jobDetail.created_by_name || null,
                  created_at: jobDetail.created_at,
                };
                // 2. All subsequent changes — filter out any job_created from API history
                //    (to avoid duplicate), then reverse so oldest change is first (top → bottom)
                const changeEntries = (jobDetail.history || [])
                  .filter((e) => e.event_type !== 'job_created')
                  .slice()
                  .reverse();
                const allEntries = [creationEntry, ...changeEntries];

                return (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> Activity Log
                    </p>
                    <div className="flex flex-col">
                      {allEntries.map((entry, idx) => (
                        <div key={entry.id} className="flex gap-2.5 relative pb-3 last:pb-0">
                          {/* Timeline spine connecting entries */}
                          {idx < allEntries.length - 1 && (
                            <div className="absolute left-[4px] top-2.5 bottom-0 w-px bg-slate-200" />
                          )}
                          {/* Dot — green for creation, blue for changes */}
                          <div className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 z-10 ${entry.event_type === 'job_created' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 leading-snug">{entry.description}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {entry.changed_by_name && (
                                <span className="font-medium text-slate-500">{entry.changed_by_name} · </span>
                              )}
                              {new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

      ) : (
        /* ══════════════════ JOB LIST VIEW ══════════════════ */
        <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">

          {/* Tabs */}
          <div className="flex gap-6 mb-4 border-b border-slate-200">
            {['My Jobs', 'All Jobs'].map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`pb-3 border-b-2 font-semibold transition-colors ${activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Search + status bar */}
          <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 mb-5 shadow-sm gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
                placeholder="Search jobs by title, code, location…"
                className="outline-none w-full text-sm"
              />
            </div>
            <div className="text-sm font-medium text-slate-600 px-4 border-x border-slate-200 italic shrink-0">
              {total} Jobs Found
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-600 shrink-0">
              {['open', 'abandoned', 'closed', 'all'].map((s) => (
                <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    className="accent-blue-600"
                    checked={statusFilter === s}
                    onChange={() => setStatusFilter(s)}
                  />
                  <span className="capitalize">{s}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Jobs + Filters - Using overflow-hidden to bound the height of children */}
          <div className="flex gap-5 flex-1 min-h-0 overflow-hidden">

            {/* LEFT: Job cards — independently scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto pb-4 flex flex-col gap-4">
              {loading ? (
                <PageLoader label="Loading jobs…" />
              ) : jobsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                  <Briefcase className="w-10 h-10 text-slate-300" />
                  <p className="text-sm">No jobs found.</p>
                </div>
              ) : (
                jobsList.map((job) => (
                  <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-5 flex justify-between shadow-sm hover:shadow-md transition-shadow gap-4">
                    <div className="flex flex-col gap-3 flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() => openJobDetails(job)}
                          className="text-base font-bold text-slate-800 hover:text-blue-600 text-left transition-colors"
                        >
                          {job.title}
                        </button>
                        <StatusBadge status={job.status} />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(job.created_at).toLocaleDateString('en-GB')}</span>
                        {job.department_name && (
                          <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {job.department_name}</span>
                        )}
                        {job.hiring_manager_name && (
                          <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {job.hiring_manager_name}</span>
                        )}
                        {job.purpose && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${job.purpose === 'client' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                            {job.purpose_code || job.purpose}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm font-medium text-blue-600">
                        <button onClick={() => openJobDetails(job)} className="flex items-center gap-1 hover:text-blue-800">
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button
                          onClick={() => { setAddProfileTargetJob(job); setIsAddProfileOpen(true); }}
                          className="flex items-center gap-1 hover:text-blue-800"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Add Profile
                        </button>
                        <button onClick={() => openCollabModal(job)} className="flex items-center gap-1 hover:text-blue-800">
                          <Users className="w-3.5 h-3.5" /> Collaborators
                        </button>
                      </div>
                    </div>

                    {/* Stat tiles — clicking opens detail page + pipeline panel */}
                    <div className="flex gap-1 items-center shrink-0">
                      {[
                        { label: 'Applied',     value: job.applies_count },
                        { label: 'Shortlisted', value: job.shortlists_count },
                        { label: 'Offered',     value: job.offers_count },
                        { label: 'Joined',      value: job.joined_count },
                      ].map((stat) => (
                        <button
                          key={stat.label}
                          onClick={() => openJobDetails(job, stat.label, true)}
                          className="flex flex-col items-center min-w-[60px] hover:bg-blue-50 p-2 rounded-lg transition-colors"
                        >
                          <span className="text-xl font-bold text-slate-700">{stat.value ?? 0}</span>
                          <span className="text-xs text-blue-600 font-medium">{stat.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* RIGHT: Filter panel — independently scrollable */}
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
                    <button onClick={clearFilters} className="text-blue-600 text-xs font-medium hover:underline">
                      Clear All
                    </button>
                  )}
                </div>
                <FilterAccordion
                  title="Department"
                  options={filterOptions.departments}
                  selected={filters.department}
                  onToggle={(id) => toggleFilter('department', id)}
                  defaultOpen
                />
                <FilterAccordion
                  title="Hiring Manager"
                  options={filterOptions.hiringManagers}
                  selected={filters.hiring_manager}
                  onToggle={(id) => toggleFilter('hiring_manager', id)}
                  defaultOpen={false}
                />
                <FilterAccordion
                  title="Location"
                  options={filterOptions.locations}
                  selected={filters.location}
                  onToggle={(id) => toggleFilter('location', id)}
                  defaultOpen={false}
                />
                <DateRangeFilter
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onFromChange={setDateFrom}
                  onToChange={setDateTo}
                />
                <SortFilter ordering={ordering} onChange={setOrdering} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ PIPELINE SLIDE-OVER PANEL ══════════════════ */}
      {isPipelinePanelOpen && viewingJob && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => navigate(ROUTES.JOBS.DETAIL(viewingJob.id))}
          />

          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-[640px] max-w-[92vw] bg-white shadow-2xl z-50 flex flex-col">

            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 truncate">{viewingJob.job_code} — {viewingJob.title}</p>
                <h3 className="text-base font-bold text-slate-800 mt-0.5">{pipelineTab}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  onClick={() => setIsAddProfileOpen(true)}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Profile
                </button>
                <button
                  onClick={() => navigate(ROUTES.JOBS.DETAIL(viewingJob.id))}
                  className="text-slate-400 hover:text-slate-700 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stage tabs — 6 tabs, horizontally scrollable on narrow drawers */}
            <div className="flex border-b border-slate-200 shrink-0 overflow-x-auto">
              {PIPELINE_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPipelineTab(tab)}
                  className={`flex-1 min-w-[80px] py-3 text-sm font-medium border-b-2 transition-colors text-center ${
                    pipelineTab === tab
                      ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-base font-bold">{getStatCount(tab)}</span>
                    <span className="text-[10px] uppercase tracking-wider">{tab}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Candidate list — active cards first, then dimmed (progressed past this stage) */}
            <div className="flex-1 overflow-y-auto p-4">
              {pipelineLoading ? (
                <PageLoader label="Loading candidates…" />
              ) : (() => {
                const activeCandidates = pipeline.filter(c => c.is_current_stage !== false);
                const dimmedCandidates = pipeline.filter(c => c.is_current_stage === false);
                if (activeCandidates.length === 0 && dimmedCandidates.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Users className="w-10 h-10 mb-2" />
                      <p className="text-sm">No candidates in this stage</p>
                    </div>
                  );
                }
                return (
                  <div className="flex flex-col gap-3">
                    {activeCandidates.map(renderCandidateCard)}
                    {dimmedCandidates.length > 0 && (
                      <>
                        <div className="text-xs text-slate-400 text-center py-1 border-t border-dashed border-slate-200">
                          progressed past this stage
                        </div>
                        {dimmedCandidates.map(renderCandidateCard)}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════ DROP CANDIDATE MODAL ══════════════════ */}
      {dropModalCandidate && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[400]">
          <div className="bg-white rounded-xl shadow-2xl w-[420px] max-w-[92vw] p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Drop Candidate</h3>
              <button onClick={() => setDropModalCandidate(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Drop <strong>{dropModalCandidate.candidate_name}</strong> from this job?
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Reason</label>
              <select
                value={dropReason}
                onChange={(e) => setDropReason(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
              >
                <option value="REJECTED">Rejected</option>
                <option value="CANDIDATE_DROP">Candidate Drop</option>
                <option value="NO_SHOW">No Show</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDropModalCandidate(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDropConfirm}
                disabled={dropLoading}
                className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium disabled:opacity-50 transition-colors"
              >
                {dropLoading ? 'Dropping…' : 'Confirm Drop'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ CLOSE JOB CONFIRMATION ══════════════════ */}
      {isCloseConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[300]">
          <div className="bg-white rounded-xl shadow-2xl w-[420px] max-w-[92vw] p-6 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-slate-800">Close this job?</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Closing a job is <strong>permanent and irreversible</strong>. Once closed, the status
              cannot be changed and the job cannot be reopened or abandoned.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setIsCloseConfirmOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setEditForm((f) => ({ ...f, status: 'closed' }));
                  setIsCloseConfirmOpen(false);
                }}
                className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium transition-colors"
              >
                Yes, Close Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ EDIT JOB MODAL ══════════════════ */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[600px] max-w-[92vw] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800">Edit Job Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">{jobDetail?.job_code} — {jobDetail?.title}</p>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-sm font-medium text-slate-700">Job Title</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  {jobDetail?.status === 'closed' ? (
                    <div className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                      Closed — no further changes allowed
                    </div>
                  ) : (
                    <select
                      value={editForm.status}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'closed') {
                          setIsCloseConfirmOpen(true);
                        } else {
                          setEditForm({ ...editForm, status: val });
                        }
                      }}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
                    >
                      {(jobDetail?.status === 'open'
                        ? ['open', 'closed', 'abandoned']
                        : jobDetail?.status === 'abandoned'
                        ? ['abandoned', 'open', 'closed']
                        : ['open', 'abandoned', 'closed']
                      ).map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Experience Min (yrs)</label>
                  <input
                    type="number" step="0.5" min="0"
                    value={editForm.experience_min}
                    onChange={(e) => setEditForm({ ...editForm, experience_min: e.target.value })}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Experience Max (yrs)</label>
                  <input
                    type="number" step="0.5" min="0"
                    value={editForm.experience_max}
                    onChange={(e) => setEditForm({ ...editForm, experience_max: e.target.value })}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    Required Skills <span className="font-normal text-slate-400">(comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.skills_required}
                    onChange={(e) => setEditForm({ ...editForm, skills_required: e.target.value })}
                    placeholder="e.g. Python, Django, React"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-sm font-medium text-slate-700">Job Description</label>
                  <textarea
                    rows={5}
                    value={editForm.job_description}
                    onChange={(e) => setEditForm({ ...editForm, job_description: e.target.value })}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsEditOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {editLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ COLLABORATORS MODAL ══════════════════ */}
      {isCollabModalOpen && selectedJob && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[560px] max-w-[92vw] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Collaborators</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedJob.job_code} — {selectedJob.title}</p>
              </div>
              <button onClick={() => setIsCollabModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
              {collabError && (
                <div className="text-sm px-4 py-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                  {collabError}
                </div>
              )}

              {/* Current collaborators */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" /> Current Collaborators
                </h4>
                {collabLoading ? (
                  <p className="text-sm text-slate-400 italic">Loading…</p>
                ) : collabList.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No collaborators assigned yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {collabList.map((c) => (
                      <div key={c.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                            {c.user_name ? c.user_name.slice(0, 2).toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{c.user_name}</p>
                            <p className="text-xs text-slate-500">{c.user_email}</p>
                          </div>
                        </div>
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleRemoveCollab(c.user)}
                            disabled={collabActionLoading}
                            className="text-xs text-rose-600 hover:text-rose-800 font-medium disabled:opacity-50 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add collaborator — admin only */}
              {user?.role === 'admin' ? (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-slate-400" /> Add Collaborator
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">Showing recruiters — type to filter by name or email.</p>
                  <input
                    type="text"
                    value={collabFilter}
                    onChange={(e) => setCollabFilter(e.target.value)}
                    onFocus={() => setCollabInputFocused(true)}
                    onBlur={() => setTimeout(() => setCollabInputFocused(false), 150)}
                    placeholder="Search recruiters…"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  {collabInputFocused && recruiterUsers.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 max-h-52 overflow-y-auto">
                      {recruiterUsers
                        .filter((u) => {
                          const kw = collabFilter.toLowerCase();
                          return !kw || u.full_name?.toLowerCase().includes(kw) || u.email?.toLowerCase().includes(kw);
                        })
                        .map((u) => {
                          const already = collabList.some((c) => c.user === u.id);
                          return (
                            <div key={u.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2.5 bg-white">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                                  {u.full_name ? u.full_name.slice(0, 2).toUpperCase() : '?'}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{u.full_name}</p>
                                  <p className="text-xs text-slate-500">{u.email}</p>
                                </div>
                              </div>
                              {already ? (
                                <span className="text-xs text-slate-400 italic">Already added</span>
                              ) : (
                                <button
                                  onClick={() => handleAddCollab(u.id)}
                                  disabled={collabActionLoading}
                                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                  Add
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                  {collabSuccess && (
                    <p className="mt-2 text-xs text-emerald-600 font-medium">{collabSuccess}</p>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic flex items-center gap-1.5 py-1">
                  <Users className="w-3.5 h-3.5" />
                  Only admins can add or remove collaborators.
                </div>
              )}
            </div>

            <div className="px-5 pb-5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsCollabModalOpen(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ ADD PROFILE MODAL ══════════════════ */}
      {isAddProfileOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[560px] max-w-[92vw]">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Add Profile Manually</h3>
              <button onClick={() => { setIsAddProfileOpen(false); setAddProfileTargetJob(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-sm font-medium text-slate-700">Full Name *</label>
                  <input type="text" value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Email *</label>
                  <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Phone</label>
                  <input type="tel" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Location</label>
                  <input type="text" value={addForm.location} onChange={(e) => setAddForm({ ...addForm, location: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Experience (years)</label>
                  <input type="number" step="0.1" value={addForm.total_experience_years} onChange={(e) => setAddForm({ ...addForm, total_experience_years: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setIsAddProfileOpen(false); setAddProfileTargetJob(null); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
                <button onClick={handleAddProfile} disabled={addLoading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  {addLoading ? 'Saving…' : 'Save Profile'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ SCHEDULE INTERVIEW MODAL ══════════════════ */}
      {isScheduleOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[580px] max-w-[92vw]">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Schedule Interview</h3>
              <button onClick={closeScheduleModal} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {scheduleToast && (
                <div className={`text-sm px-4 py-3 rounded-lg font-medium ${scheduleToast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                  {scheduleToast.message}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Candidate</label>
                <div className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 bg-slate-50">
                  {scheduleCandidate?.candidate_name || '—'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Round</label>
                  <select value={scheduleForm.round_label} onChange={(e) => setScheduleForm({ ...scheduleForm, round_label: e.target.value, round_number: e.target.selectedIndex })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white">
                    <option value="">Select round…</option>
                    <option value="Screening Round">Screening Round</option>
                    <option value="Technical Round 1">Technical Round 1</option>
                    <option value="Technical Round 2">Technical Round 2</option>
                    <option value="Managerial Round">Managerial Round</option>
                    <option value="HR Round">HR Round</option>
                    <option value="Final Round">Final Round</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Interviewer *</label>
                  <select value={scheduleForm.interviewer} onChange={(e) => setScheduleForm({ ...scheduleForm, interviewer: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white">
                    <option value="">Select interviewer…</option>
                    {usersList.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Date *</label>
                  <input
                    type="date"
                    value={scheduleForm.scheduled_at ? scheduleForm.scheduled_at.split('T')[0] : ''}
                    onChange={(e) => {
                      const time = scheduleForm.scheduled_at ? scheduleForm.scheduled_at.split('T')[1] : '00:00';
                      setScheduleForm({ ...scheduleForm, scheduled_at: `${e.target.value}T${time}` });
                    }}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Time *</label>
                  <input
                    type="time"
                    value={scheduleForm.scheduled_at ? scheduleForm.scheduled_at.split('T')[1] : ''}
                    onChange={(e) => {
                      const date = scheduleForm.scheduled_at ? scheduleForm.scheduled_at.split('T')[0] : '';
                      setScheduleForm({ ...scheduleForm, scheduled_at: `${date}T${e.target.value}` });
                    }}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Duration (minutes)</label>
                  <input type="number" min="15" step="15" value={scheduleForm.duration_minutes} onChange={(e) => setScheduleForm({ ...scheduleForm, duration_minutes: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Mode</label>
                  <select value={scheduleForm.mode} onChange={(e) => setScheduleForm({ ...scheduleForm, mode: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white">
                    <option value="virtual">Virtual</option>
                    <option value="phone">Phone</option>
                    <option value="face_to_face">Face to Face</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Meeting Link <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="text" placeholder="https://meet.google.com/..." value={scheduleForm.meeting_link} onChange={(e) => setScheduleForm({ ...scheduleForm, meeting_link: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button onClick={closeScheduleModal} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
              <button
                onClick={handleScheduleSubmit}
                disabled={scheduleLoading || !scheduleForm.interviewer || !scheduleForm.scheduled_at}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {scheduleLoading ? 'Scheduling…' : 'Schedule Interview'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ DELETE JOB CONFIRMATION MODAL ══════════════════ */}
      {isDeleteJobOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[440px] max-w-[92vw] p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Delete Job</h3>
                <p className="text-xs text-slate-500 mt-0.5">{jobDetail?.job_code} — {jobDetail?.title}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete this job? This action <span className="font-semibold text-rose-600">cannot be undone</span> and will remove all associated pipeline data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsDeleteJobOpen(false)}
                disabled={deleteJobLoading}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteJob}
                disabled={deleteJobLoading}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {deleteJobLoading ? 'Deleting…' : 'Yes, Delete Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share success toast */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] bg-green-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          {shareToast}
        </div>
      )}

      {/* Add Profile success toast */}
      {addProfileSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] bg-green-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          {addProfileSuccess}
        </div>
      )}

      {/* Reminder modal */}
      {reminderCandidate && (
        <ReminderModal
          candidate={reminderCandidate}
          onClose={() => setReminderCandidate(null)}
          queryClient={queryClient}
        />
      )}
    </>
  );
}
