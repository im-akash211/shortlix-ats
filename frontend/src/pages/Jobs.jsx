import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../lib/useDebounce';
import { useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { PageLoader } from '../components/LoadingDots';
import { ROUTES } from '../routes/constants';
import {
  Search, MapPin, Clock, Eye, Mail, UserPlus, Users, ChevronDown, ChevronUp,
  User, X, Filter, Phone, Briefcase, Building2, ChevronRight, Edit2, BookOpen, Trash2, FileText, Share2,
} from 'lucide-react';
import {
  jobs as jobsApi,
  candidates as candidatesApi,
  interviews as interviewsApi,
  users as usersApi,
  candidateShare as candidateShareApi,
} from '../lib/api';

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
  pending: 'Pending', shortlisted: 'Shortlisted', interview: 'Interview',
  on_hold: 'On Hold', selected: 'Selected', rejected: 'Rejected',
  offered: 'Offered', joined: 'Joined',
};

const STAGE_COLORS = {
  pending:     'bg-amber-100 text-amber-700',
  shortlisted: 'bg-blue-100 text-blue-700',
  interview:   'bg-purple-100 text-purple-700',
  on_hold:     'bg-slate-100 text-slate-600',
  selected:    'bg-emerald-100 text-emerald-700',
  rejected:    'bg-rose-100 text-rose-700',
  offered:     'bg-cyan-100 text-cyan-700',
  joined:      'bg-green-100 text-green-700',
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

// ─── Stage map ────────────────────────────────────────────────────────────────

// Each tab maps to the stage(s) shown in the candidate listing.
// Applies = all (no filter); others use comma-separated multi-stage.
const STAGE_TAB_MAP = {
  Applies:    null,
  Shortlists: 'shortlisted,interview,selected',
  Offers:     'offered',
  Joined:     'joined',
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function Jobs({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── URL-based List state ───────────────────────────────────────────────────
  const activeTab = searchParams.get('tab') || 'All Jobs';
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';

  const setActiveTab = (val) => setSearchParams(p => { p.set('tab', val); return p; });
  const setSearch = (val) => setSearchParams(p => { if (val) p.set('search', val); else p.delete('search'); return p; });
  const setStatusFilter = (val) => setSearchParams(p => { p.set('status', val); return p; });

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
  const [pipelineTab, setPipelineTab]       = useState('Applies');
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

  // ── Add Profile modal state ──────────────────────────────────────────────────
  const [isAddProfileOpen, setIsAddProfileOpen] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: '', email: '', phone: '', location: '', total_experience_years: '' });
  const [addLoading, setAddLoading] = useState(false);

  // ── Shortlist action state ────────────────────────────────────────────────────
  const [shortlistingId, setShortlistingId] = useState(null);

  // ── Candidate profile modal state ────────────────────────────────────────────
  const [candidateProfile, setCandidateProfile] = useState(null);
  const [candidateProfileLoading, setCandidateProfileLoading] = useState(false);

  const openCandidateProfile = async (c) => {
    setCandidateProfile(null);
    setCandidateProfileLoading(true);
    try {
      const detail = await candidatesApi.detail(c.candidate);
      setCandidateProfile(detail);
    } catch (err) {
      console.error(err);
    } finally {
      setCandidateProfileLoading(false);
    }
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
      return prev;
    });
  };

  const activeFilterCount =
    filters.department.length +
    filters.hiring_manager.length +
    filters.location.length;

  // ── Phase B+C: jobs list — cached per filter combination; previous data shown while new results load ──
  const jobsQueryKey = ['jobs', 'list', { tab: activeTab, status: statusFilter, search, dept: filters.department, hm: filters.hiring_manager, loc: filters.location }];
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
      return jobsApi.list(params);
    },
    placeholderData: (previousData) => previousData,
  });

  const jobsList = jobsQueryData ? (jobsQueryData.results || jobsQueryData) : [];
  const total    = jobsQueryData?.count ?? jobsList.length;

  // ── Open job detail ──────────────────────────────────────────────────────────
  // ── Open job detail ──────────────────────────────────────────────────────────
  const openJobDetails = (job, tab = 'Applies', openPanel = false) => {
    // Set viewingJob immediately so the detail view renders at once (optimistic)
    setViewingJob(job);
    setPipelineTab(tab);
    if (openPanel || tab !== 'Applies') {
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
  useEffect(() => {
    if (!viewingJob || !isPipelinePanelOpen) return;
    setPipelineLoading(true);
    const stage = STAGE_TAB_MAP[pipelineTab];
    jobsApi.pipeline(viewingJob.id, stage ? { stage } : {})
      .then((res) => setPipeline(res.results || res))
      .catch(console.error)
      .finally(() => setPipelineLoading(false));
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
    setCollabEmail('');
    setCollabSearchResults([]);
    setIsCollabModalOpen(true);
    fetchCollaborators(job.id);
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
    try {
      await jobsApi.addCollaborator(selectedJob.id, userId);
      setCollabSearchResults([]);
      setCollabEmail('');
      fetchCollaborators(selectedJob.id);
      // Refresh detail collaborators list if viewing that job
      if (viewingJob?.id === selectedJob.id) {
        jobsApi.detail(selectedJob.id).then(setJobDetail).catch(console.error);
      }
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
    try {
      const candidate = await candidatesApi.create({
        ...addForm,
        total_experience_years: addForm.total_experience_years || null,
        source: 'manual',
      });
      if (viewingJob) await candidatesApi.assignJob(candidate.id, viewingJob.id);
      setIsAddProfileOpen(false);
      setAddForm({ full_name: '', email: '', phone: '', location: '', total_experience_years: '' });
      if (viewingJob) {
        setPipelineTab('Applies');
        setIsPipelinePanelOpen(true);
        // Refresh stats
        jobsApi.pipelineStats(viewingJob.id).then(setPipelineStats).catch(console.error);
      }
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

  // ── Shortlist candidate ──────────────────────────────────────────────────────
  const handleShortlist = async (c) => {
    setShortlistingId(c.id);
    try {
      await candidatesApi.changeStage(c.candidate, c.job, 'shortlisted');
      // Refresh listing (candidate moves out of Applies, so re-fetch current tab)
      const stage = STAGE_TAB_MAP[pipelineTab];
      jobsApi.pipeline(viewingJob.id, stage ? { stage } : {})
        .then((res) => setPipeline(res.results || res))
        .catch(console.error);
      jobsApi.pipelineStats(viewingJob.id).then(setPipelineStats).catch(console.error);
    } catch (err) {
      alert(err.data?.detail || 'Failed to shortlist candidate');
    } finally {
      setShortlistingId(null);
    }
  };

  // ── Pipeline stat helpers ────────────────────────────────────────────────────
  const getStatCount = (tab) => {
    if (!pipelineStats) return 0;
    if (tab === 'Applies')    return pipelineStats.total || 0;
    if (tab === 'Shortlists') return (pipelineStats.shortlisted || 0) + (pipelineStats.interview || 0) + (pipelineStats.selected || 0);
    if (tab === 'Offers')     return pipelineStats.offered || 0;
    if (tab === 'Joined')     return pipelineStats.joined || 0;
    return 0;
  };

  // ── Candidate card ───────────────────────────────────────────────────────────
  const renderCandidateCard = (c) => {
    const isShareOpen = shareOpen === c.id;
    const filteredUsers = usersList.filter(u =>
      u.full_name.toLowerCase().includes(shareSearch.toLowerCase())
    );
    return (
    <div key={c.id} className="flex gap-4 border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white">
      <button
        onClick={() => openCandidateProfile(c)}
        className="w-11 h-11 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0 hover:bg-blue-200 transition-colors"
      >
        {c.candidate_name ? c.candidate_name.slice(0, 2).toUpperCase() : '?'}
      </button>
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <button onClick={() => openCandidateProfile(c)} className="text-sm font-bold text-slate-800 hover:text-blue-600 transition-colors text-left">{c.candidate_name}</button>
            <p className="text-xs text-slate-500 mt-0.5">Stage: <span className="capitalize font-medium text-slate-700">{c.stage}</span></p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => openCandidateProfile(c)}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-medium transition-colors"
            >
              View Profile
            </button>
            {c.stage === 'pending' && (
              <button
                onClick={() => handleShortlist(c)}
                disabled={shortlistingId === c.id}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded font-medium transition-colors"
              >
                {shortlistingId === c.id ? 'Moving…' : 'Shortlist'}
              </button>
            )}
            {c.stage === 'shortlisted' && (
              <button
                onClick={() => {
                  setScheduleCandidate(c);
                  setIsScheduleOpen(true);
                  usersApi.list().then((res) => setUsersList(res.results || res)).catch(console.error);
                }}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-medium transition-colors"
              >
                Schedule Interview
              </button>
            )}
            {/* Share button + popover */}
            <div className="relative" ref={isShareOpen ? shareRef : null}>
              <button
                onClick={() => { setShareOpen(isShareOpen ? null : c.id); setShareSearch(''); setShareSelected([]); }}
                className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                title="Share"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
              {isShareOpen && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-[300] flex flex-col overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search users..."
                      value={shareSearch}
                      onChange={(e) => setShareSearch(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="overflow-y-auto max-h-52">
                    {usersLoading ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
                        <svg className="animate-spin w-4 h-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                        <span className="text-xs">Loading users...</span>
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No users found</p>
                    ) : filteredUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shareSelected.includes(u.id)}
                          onChange={() => setShareSelected(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                          className="accent-blue-600"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{u.full_name}</p>
                          <p className="text-xs text-slate-400 truncate capitalize">{u.role?.replace('_', ' ')}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t border-slate-100">
                    <button
                      disabled={shareSelected.length === 0}
                      onClick={async () => {
                        const count = shareSelected.length;
                        try {
                          await candidateShareApi.share(c.candidate, shareSelected);
                          setShareToast(`Profile shared with ${count} user${count > 1 ? 's' : ''} successfully`);
                          setTimeout(() => setShareToast(null), 3000);
                        } catch (err) {
                          console.error('Share failed', err);
                        }
                        setShareOpen(null); setShareSearch(''); setShareSelected([]);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors"
                    >
                      Share{shareSelected.length > 0 ? ` (${shareSelected.length})` : ''}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <Mail className="w-3 h-3" />, label: 'Email', value: c.candidate_email },
            { icon: <span className="text-[10px]">☏</span>, label: 'Phone', value: c.candidate_phone || '—' },
            { icon: <MapPin className="w-3 h-3" />, label: 'Location', value: c.candidate_location || '—' },
            { icon: <Clock className="w-3 h-3" />, label: 'Exp', value: c.candidate_experience ? `${c.candidate_experience} yrs` : '—' },
          ].map(({ icon, label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-500 flex items-center gap-1">{icon} {label}</span>
              <span className="text-xs font-medium text-slate-800 truncate">{value}</span>
            </div>
          ))}
        </div>
        {c.candidate_skills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {c.candidate_skills.slice(0, 5).map((s, i) => (
              <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{s}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  ); };

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ══════════ CANDIDATE PROFILE MODAL ══════════ */}
      <Modal isOpen={candidateProfile !== null || candidateProfileLoading} onClose={() => { setCandidateProfile(null); setCandidateProfileLoading(false); }} title="Candidate Profile" maxWidth="max-w-3xl">
        {candidateProfileLoading ? (
          <PageLoader label="Loading profile…" />
        ) : candidateProfile ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold shrink-0">
                {candidateProfile.full_name?.slice(0, 2).toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-slate-800 truncate">{candidateProfile.full_name}</h3>
                {candidateProfile.designation && <p className="text-sm text-slate-600 mt-0.5">{candidateProfile.designation}</p>}
                {candidateProfile.current_employer && <p className="text-xs text-slate-500 mt-0.5">{candidateProfile.current_employer}</p>}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {candidateProfile.source && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                      {SOURCE_LABELS[candidateProfile.source] || candidateProfile.source}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    Added {new Date(candidateProfile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => openResume(candidateProfile)}
                className="shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Resume
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4">
              {[
                { icon: <Mail className="w-4 h-4" />,     label: 'Email',      value: candidateProfile.email || '—' },
                { icon: <Phone className="w-4 h-4" />,    label: 'Phone',      value: candidateProfile.phone || '—' },
                { icon: <MapPin className="w-4 h-4" />,   label: 'Location',   value: candidateProfile.location || '—' },
                { icon: <Briefcase className="w-4 h-4" />,label: 'Experience', value: candidateProfile.total_experience_years ? `${candidateProfile.total_experience_years} years` : '—' },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-2.5">
                  <span className="text-slate-400 mt-0.5 shrink-0">{icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-sm font-medium text-slate-800 truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
            {candidateProfile.skills?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {candidateProfile.skills.map((s, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {candidateProfile.job_mappings?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Job Applications ({candidateProfile.job_mappings.length})</p>
                <div className="flex flex-col gap-2">
                  {candidateProfile.job_mappings.map((m) => (
                    <div key={m.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2.5 bg-white">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{m.job_title}</p>
                        <p className="text-xs text-slate-500">{m.job_code}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ml-3 ${STAGE_COLORS[m.stage] || 'bg-slate-100 text-slate-600'}`}>
                        {STAGE_LABELS[m.stage] || m.stage}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {candidateProfile.notes?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Notes ({candidateProfile.notes.length})</p>
                <div className="flex flex-col gap-2">
                  {candidateProfile.notes.map((n) => (
                    <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-slate-700 leading-relaxed">{n.content}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                        <User className="w-3 h-3" />
                        <span>{n.user_name}</span>
                        <span>·</span>
                        <Clock className="w-3 h-3" />
                        <span>{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

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
          <div className="flex items-center justify-between mb-4 shrink-0">
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
            <div className="flex items-center gap-2 shrink-0">
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
                          #{jobDetail.job_code} | {jobDetail.title}
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
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Pipeline Overview</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { label: 'Views',      value: jobDetail?.view_count || 0, tab: null },
                    { label: 'Applies',    value: getStatCount('Applies'),    tab: 'Applies' },
                    { label: 'Shortlists', value: getStatCount('Shortlists'), tab: 'Shortlists' },
                  ].map(({ label, value, tab }) => (
                    <button
                      key={label}
                      onClick={() => { if (tab) { setPipelineTab(tab); navigate(ROUTES.JOBS.CANDIDATES(viewingJob.id)); } }}
                      disabled={!tab}
                      className={`flex flex-col items-center p-2 rounded-lg transition-colors disabled:cursor-default ${tab ? 'hover:bg-blue-50 cursor-pointer' : ''}`}
                    >
                      <span className="text-2xl font-bold text-slate-700">{value}</span>
                      <span className={`text-xs font-medium ${tab ? 'text-blue-600' : 'text-slate-500'}`}>{label}</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Offers', value: getStatCount('Offers'), tab: 'Offers' },
                    { label: 'Joined', value: getStatCount('Joined'), tab: 'Joined' },
                  ].map(({ label, value, tab }) => (
                    <button
                      key={label}
                      onClick={() => { setPipelineTab(tab); navigate(ROUTES.JOBS.CANDIDATES(viewingJob.id)); }}
                      className="flex flex-col items-center p-2 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <span className="text-2xl font-bold text-slate-700">{value}</span>
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
                          onClick={() => { setViewingJob(job); setJobDetail(null); setIsAddProfileOpen(true); }}
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
                        { label: 'Applies',    value: job.applies_count },
                        { label: 'Shortlists', value: job.shortlists_count },
                        { label: 'Offers',     value: job.offers_count },
                        { label: 'Joined',     value: job.joined_count },
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

            {/* Stage tabs */}
            <div className="flex border-b border-slate-200 shrink-0">
              {['Applies', 'Shortlists', 'Offers', 'Joined'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPipelineTab(tab)}
                  className={`flex-1 py-3.5 text-sm font-medium border-b-2 transition-colors text-center ${
                    pipelineTab === tab
                      ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-lg font-bold">{getStatCount(tab)}</span>
                    <span className="text-xs uppercase tracking-wider">{tab}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Candidate list */}
            <div className="flex-1 overflow-y-auto p-5">
              {pipelineLoading ? (
                <PageLoader label="Loading candidates…" />
              ) : pipeline.length > 0 ? (
                <div className="flex flex-col gap-4">{pipeline.map(renderCandidateCard)}</div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Users className="w-12 h-12 text-slate-300 mb-4" />
                  <p className="text-base font-medium">No candidates in {pipelineTab}</p>
                  <p className="text-sm text-slate-400 mt-1">Add profiles to get started.</p>
                </div>
              )}
            </div>
          </div>
        </>
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
                  <p className="text-xs text-slate-500 mb-3">Search by email address to find a registered user.</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={collabEmail}
                      onChange={(e) => { setCollabEmail(e.target.value); setCollabSearchResults([]); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleCollabSearch()}
                      placeholder="user@example.com"
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleCollabSearch}
                      disabled={collabSearchLoading || !collabEmail.trim()}
                      className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors shrink-0"
                    >
                      {collabSearchLoading ? '…' : 'Search'}
                    </button>
                  </div>
                  {collabSearchResults.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {collabSearchResults.map((u) => {
                        const already = collabList.some((c) => c.user === u.id);
                        return (
                          <div key={u.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2.5 bg-white">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {u.full_name ? u.full_name.slice(0, 2).toUpperCase() : '?'}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{u.full_name}</p>
                                <p className="text-xs text-slate-500">{u.email} · <span className="capitalize">{u.role}</span></p>
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
              <button onClick={() => setIsAddProfileOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
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
                <button onClick={() => setIsAddProfileOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
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
    </>
  );
}
