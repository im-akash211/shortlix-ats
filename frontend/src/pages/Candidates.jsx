import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Eye, Edit, MapPin, Phone, Mail, Filter,
  MessageSquarePlus, X, ChevronDown, ChevronUp, Briefcase, User, Clock,
  Upload, CheckCircle, AlertCircle, Loader, FileText,
} from 'lucide-react';
import { candidates as candidatesApi, jobs as jobsApi, resumes as resumesApi } from '../lib/api';

// ─── Shared modal wrapper ──────────────────────────────────────────────────────
function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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

// ─── Collapsible filter section ────────────────────────────────────────────────
function FilterSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 text-sm">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && <div className="px-4 pb-4 flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const SOURCE_LABELS = {
  recruiter_upload: 'Recruiter Upload',
  naukri: 'Naukri',
  linkedin: 'LinkedIn',
  referral: 'Referral',
  manual: 'Manual',
};

const STAGE_LABELS = {
  pending: 'Pending',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  on_hold: 'On Hold',
  selected: 'Selected',
  rejected: 'Rejected',
  offered: 'Offered',
  joined: 'Joined',
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

const EMPTY_FILTERS = {
  source: [], stage: [], job: '',
  exp_min: '', exp_max: '',
  date_from: '', date_to: '',
};

// ─── Main component ────────────────────────────────────────────────────────────
export default function Candidates({ user }) {
  // List state
  const [data, setData]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  // Modal state
  const [activeModal, setActiveModal]           = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  // View profile
  const [profileDetail, setProfileDetail]   = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Edit modal
  const [editForm, setEditForm]       = useState({});
  const [editLoading, setEditLoading] = useState(false);

  // Note modal
  const [noteText, setNoteText]       = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  // Move modal
  const [allJobs, setAllJobs]   = useState([]);
  const [moveJobId, setMoveJobId] = useState('');

  // Filters
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Upload Resume modal
  const [uploadFile, setUploadFile]         = useState(null);
  const [uploadLoading, setUploadLoading]   = useState(false);
  const [uploadResult, setUploadResult]     = useState(null); // ingestion record
  const [uploadError, setUploadError]       = useState('');
  const fileInputRef                        = useRef(null);
  const pollIntervalRef                     = useRef(null);

  const activeFilterCount =
    filters.source.length +
    filters.stage.length +
    (filters.job ? 1 : 0) +
    (filters.exp_min || filters.exp_max ? 1 : 0) +
    (filters.date_from || filters.date_to ? 1 : 0);

  // ── Load candidates ────────────────────────────────────────────────────────
  const loadCandidates = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search)              params.search    = search;
    if (filters.source.length) params.source  = filters.source.join(',');
    if (filters.stage.length)  params.stage   = filters.stage.join(',');
    if (filters.job)           params.job     = filters.job;
    if (filters.exp_min)       params.exp_min = filters.exp_min;
    if (filters.exp_max)       params.exp_max = filters.exp_max;
    if (filters.date_from)     params.date_from = filters.date_from;
    if (filters.date_to)       params.date_to   = filters.date_to;

    candidatesApi.list(params)
      .then((res) => {
        setData(res.results || res);
        setTotal(res.count || (res.results || res).length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, filters]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  // Load all jobs once (for Move modal + Job filter)
  useEffect(() => {
    jobsApi.list({ page_size: 200 })
      .then((res) => setAllJobs(res.results || res))
      .catch(console.error);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const openModal = (type, candidate) => {
    setSelectedCandidate(candidate);
    setActiveModal(type);
    setNoteText('');
    setMoveJobId('');
    if (type === 'edit') {
      setEditForm({
        full_name:               candidate.full_name || '',
        email:                   candidate.email || '',
        phone:                   candidate.phone || '',
        location:                candidate.location || '',
        total_experience_years:  candidate.total_experience_years ?? '',
        designation:             candidate.designation || '',
      });
    }
  };

  const openViewProfile = (candidate) => {
    setSelectedCandidate(candidate);
    setProfileDetail(null);
    setProfileLoading(true);
    setActiveModal('view');
    candidatesApi.detail(candidate.id)
      .then(setProfileDetail)
      .catch(console.error)
      .finally(() => setProfileLoading(false));
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedCandidate(null);
    setProfileDetail(null);
  };

  const toggleArrayFilter = (key, value) =>
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSearch = (e) => { e.preventDefault(); loadCandidates(); };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !selectedCandidate) return;
    setNoteLoading(true);
    try {
      await candidatesApi.addNote(selectedCandidate.id, noteText);
      closeModal();
    } catch {
      alert('Failed to save note');
    } finally {
      setNoteLoading(false);
    }
  };

  const handleEditSave = async () => {
    if (!selectedCandidate) return;
    setEditLoading(true);
    try {
      const payload = {
        ...editForm,
        total_experience_years: editForm.total_experience_years !== ''
          ? Number(editForm.total_experience_years)
          : null,
      };
      await candidatesApi.update(selectedCandidate.id, payload);
      closeModal();
      loadCandidates();
    } catch (err) {
      alert(err.data?.detail || JSON.stringify(err.data) || 'Failed to save changes');
    } finally {
      setEditLoading(false);
    }
  };

  const handleMove = async () => {
    if (!moveJobId || !selectedCandidate) return;
    const currentJobId = selectedCandidate.current_job?.id;
    try {
      if (!currentJobId) {
        await candidatesApi.assignJob(selectedCandidate.id, moveJobId);
      } else {
        await candidatesApi.moveJob(selectedCandidate.id, currentJobId, moveJobId);
      }
      closeModal();
      loadCandidates();
    } catch (err) {
      alert(err.data?.error || 'Failed to move candidate');
    }
  };

  // ── Upload resume handlers ─────────────────────────────────────────────────
  const openUploadModal = () => {
    setUploadFile(null);
    setUploadResult(null);
    setUploadError('');
    setUploadLoading(false);
    setActiveModal('upload');
  };

  const closeUploadModal = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setActiveModal(null);
    setUploadFile(null);
    setUploadResult(null);
    setUploadError('');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      setUploadError('Only PDF and DOCX files are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File exceeds the 10 MB size limit.');
      return;
    }
    setUploadError('');
    setUploadFile(file);
  };

  const startPolling = (ingestionId) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const record = await resumesApi.status(ingestionId);
        setUploadResult(record);
        const terminal = ['parsed', 'failed', 'review_pending'];
        if (terminal.includes(record.status)) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } catch {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }, 2500);
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) return;
    setUploadLoading(true);
    setUploadError('');
    try {
      const record = await resumesApi.upload(uploadFile);
      setUploadResult(record);
      // Poll for status updates until terminal state
      if (!['parsed', 'failed', 'review_pending'].includes(record.status)) {
        startPolling(record.id);
      }
    } catch (err) {
      const msg = err.data?.file?.[0] || err.data?.detail || err.message || 'Upload failed';
      setUploadError(msg);
    } finally {
      setUploadLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">

      {/* Top bar */}
      <div className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-medium">Talent Pool Search</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={openUploadModal}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Resume
          </button>
          <span className="text-sm">Welcome, {user?.full_name || 'User'}</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-6 flex-1 min-h-0 p-6 overflow-hidden">

        {/* ── Left: table ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

          {/* Search / toolbar */}
          <div className="p-4 border-b border-slate-200 flex items-center gap-4 shrink-0">
            <form onSubmit={handleSearch} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center border border-slate-300 rounded-md overflow-hidden bg-white w-96 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email, skills…"
                    className="w-full px-3 py-2 text-sm outline-none"
                  />
                  <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Search className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
              <span className="text-xs text-slate-500 shrink-0">{total} Profiles found</span>
            </form>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-xs text-blue-600 hover:underline font-medium shrink-0"
              >
                Clear Filters ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading candidates…</div>
            ) : (
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-slate-300 cursor-pointer" />
                        Applicant
                      </div>
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200">Job Applied</th>
                    <th className="px-4 py-3 border-b border-slate-200">Status</th>
                    <th className="px-4 py-3 border-b border-slate-200">Source</th>
                    <th className="px-4 py-3 border-b border-slate-200">Date Added</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((c) => (
                    <tr key={c.id} className="hover:bg-blue-50/50 transition-colors">

                      {/* Applicant cell */}
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <input type="checkbox" className="mt-1 rounded border-slate-300 cursor-pointer" />
                          <div className="flex flex-col gap-1.5">
                            <button
                              onClick={() => openViewProfile(c)}
                              className="font-semibold text-slate-800 text-sm hover:text-blue-600 text-left transition-colors"
                            >
                              {c.full_name?.toUpperCase()}
                            </button>
                            <div className="flex flex-col gap-1 text-slate-500 text-xs">
                              <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-400" /> {c.phone || '—'}</span>
                              <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-400" /> {c.email}</span>
                              <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-slate-400" /> {c.location || '—'}</span>
                              <span className="flex items-center gap-1.5"><Briefcase className="w-3 h-3 text-slate-400" /> {c.total_experience_years ? `${c.total_experience_years} Yrs` : '—'}</span>
                            </div>
                            {/* Action icons */}
                            <div className="flex items-center gap-3 mt-1 text-slate-400">
                              <button
                                onClick={() => openViewProfile(c)}
                                className="hover:text-blue-600 transition-colors"
                                title="View Profile"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openModal('note', c)}
                                className="hover:text-blue-600 transition-colors"
                                title="Add Note"
                              >
                                <MessageSquarePlus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openModal('edit', c)}
                                className="hover:text-blue-600 transition-colors"
                                title="Edit Profile"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Job Applied */}
                      <td className="px-4 py-4 align-top">
                        {c.current_job ? (
                          <div className="flex flex-col text-sm">
                            <span className="text-slate-700">{c.current_job.title}</span>
                            <span className="text-slate-500 text-xs mt-1">({c.current_job.job_code})</span>
                          </div>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 align-top">
                        {c.current_stage ? (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STAGE_COLORS[c.current_stage] || 'bg-slate-100 text-slate-600'}`}>
                            {STAGE_LABELS[c.current_stage] || c.current_stage}
                          </span>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-4 align-top">
                        <span className="text-slate-700 font-medium text-sm">
                          {SOURCE_LABELS[c.source] || c.source || '—'}
                        </span>
                      </td>

                      {/* Date Added */}
                      <td className="px-4 py-4 align-top text-slate-600 text-sm">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB') : '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 align-top text-center">
                        <button
                          onClick={() => openModal('move', c)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-1.5 rounded text-sm font-medium transition-colors shadow-sm"
                        >
                          Move
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-slate-400">No candidates found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Right: filters sidebar ── */}
        <div className="w-72 shrink-0 min-h-0 flex flex-col gap-3 overflow-y-auto pb-4">

          {/* Header */}
          <div className="flex items-center justify-between sticky top-0 bg-slate-50 py-1 z-10">
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
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-blue-600 text-xs font-medium hover:underline"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Job Applied */}
          <FilterSection title="Job Applied" defaultOpen={false}>
            <select
              value={filters.job}
              onChange={(e) => setFilters((p) => ({ ...p, job: e.target.value }))}
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
                  checked={filters.stage.includes(key)}
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
                  checked={filters.source.includes(key)}
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
                value={filters.exp_min}
                onChange={(e) => setFilters((p) => ({ ...p, exp_min: e.target.value }))}
                className="w-full border border-slate-300 rounded p-1.5 text-sm outline-none focus:border-blue-500 text-center"
              />
              <span className="text-slate-400 text-sm shrink-0">to</span>
              <input
                type="number" min="0" step="0.5" placeholder="Max"
                value={filters.exp_max}
                onChange={(e) => setFilters((p) => ({ ...p, exp_max: e.target.value }))}
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
                  value={filters.date_from}
                  onChange={(e) => setFilters((p) => ({ ...p, date_from: e.target.value }))}
                  className="border border-slate-300 rounded p-1.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">To</span>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value }))}
                  className="border border-slate-300 rounded p-1.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </FilterSection>
        </div>
      </div>

      {/* ══════════ VIEW PROFILE MODAL ══════════ */}
      <Modal isOpen={activeModal === 'view'} onClose={closeModal} title="Candidate Profile" maxWidth="max-w-3xl">
        {profileLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading profile…</div>
        ) : profileDetail ? (
          <div className="flex flex-col gap-6">

            {/* Hero header */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold shrink-0">
                {profileDetail.full_name?.slice(0, 2).toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-slate-800 truncate">{profileDetail.full_name}</h3>
                {profileDetail.designation && (
                  <p className="text-sm text-slate-600 mt-0.5">{profileDetail.designation}</p>
                )}
                {profileDetail.current_employer && (
                  <p className="text-xs text-slate-500 mt-0.5">{profileDetail.current_employer}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {profileDetail.source && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                      {SOURCE_LABELS[profileDetail.source] || profileDetail.source}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    Added {new Date(profileDetail.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Contact + Professional info grid */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4">
              {[
                { icon: <Mail className="w-4 h-4" />,     label: 'Email',      value: profileDetail.email || '—' },
                { icon: <Phone className="w-4 h-4" />,    label: 'Phone',      value: profileDetail.phone || '—' },
                { icon: <MapPin className="w-4 h-4" />,   label: 'Location',   value: profileDetail.location || '—' },
                { icon: <Briefcase className="w-4 h-4" />,label: 'Experience', value: profileDetail.total_experience_years ? `${profileDetail.total_experience_years} years` : '—' },
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

            {/* Skills */}
            {profileDetail.skills?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {profileDetail.skills.map((s, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Job Applications */}
            {profileDetail.job_mappings?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  Job Applications ({profileDetail.job_mappings.length})
                </p>
                <div className="flex flex-col gap-2">
                  {profileDetail.job_mappings.map((m) => (
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

            {/* Notes */}
            {profileDetail.notes?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  Notes ({profileDetail.notes.length})
                </p>
                <div className="flex flex-col gap-2">
                  {profileDetail.notes.map((n) => (
                    <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-slate-700 leading-relaxed">{n.content}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                        <User className="w-3 h-3" />
                        <span>{n.user_name}</span>
                        <span>·</span>
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => { closeModal(); openModal('note', profileDetail); }}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <MessageSquarePlus className="w-4 h-4" /> Add Note
              </button>
              <button
                onClick={() => { closeModal(); openModal('edit', profileDetail); }}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Edit className="w-4 h-4" /> Edit Profile
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ══════════ MOVE MODAL ══════════ */}
      <Modal isOpen={activeModal === 'move'} onClose={closeModal} title="Move applicant to a job" maxWidth="max-w-xl">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">Select job to move to</label>
            <div className="relative">
              <select
                value={moveJobId}
                onChange={(e) => setMoveJobId(e.target.value)}
                className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">Select a job…</option>
                {allJobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.job_code} — {j.title} ({j.location})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleMove} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors">Move</button>
            <button onClick={closeModal} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-md text-sm font-medium transition-colors">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* ══════════ ADD NOTE MODAL ══════════ */}
      <Modal isOpen={activeModal === 'note'} onClose={closeModal} title="Add Note" maxWidth="max-w-xl">
        <div className="flex flex-col gap-4">
          {selectedCandidate && (
            <p className="text-sm text-slate-500">
              Note for <span className="font-semibold text-slate-700">{selectedCandidate.full_name}</span>
            </p>
          )}
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Enter note…"
            className="w-full border border-slate-300 rounded-md p-3 text-sm outline-none focus:border-blue-500 min-h-[120px] resize-y"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveNote}
              disabled={noteLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {noteLoading ? 'Saving…' : 'Save'}
            </button>
            <button onClick={closeModal} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-md text-sm font-medium transition-colors">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* ══════════ EDIT PROFILE MODAL ══════════ */}
      <Modal isOpen={activeModal === 'edit'} onClose={closeModal} title="Edit Profile" maxWidth="max-w-2xl">
        {selectedCandidate && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">Full Name *</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">Phone Number</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">Current Location</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">Total Experience (years)</label>
                <input
                  type="number" step="0.1" min="0"
                  value={editForm.total_experience_years}
                  onChange={(e) => setEditForm({ ...editForm, total_experience_years: e.target.value })}
                  className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">Designation</label>
                <input
                  type="text"
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={handleEditSave}
                disabled={editLoading || !editForm.full_name}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {editLoading ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={closeModal} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-md text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════ UPLOAD RESUME MODAL ══════════ */}
      <Modal isOpen={activeModal === 'upload'} onClose={closeUploadModal} title="Upload Resume" maxWidth="max-w-xl">
        <div className="flex flex-col gap-5">

          {/* Step 1: File picker (only shown before upload starts) */}
          {!uploadResult && (
            <>
              <p className="text-sm text-slate-500">
                Upload a candidate's resume in PDF or DOCX format. The AI will automatically
                extract structured information.
              </p>

              {/* Drop zone / file picker */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors group"
              >
                <FileText className="w-10 h-10 text-slate-300 group-hover:text-blue-400 transition-colors" />
                {uploadFile ? (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">{uploadFile.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-600">Click to select a file</p>
                    <p className="text-xs text-slate-400 mt-0.5">PDF or DOCX · Max 10 MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {uploadError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleUploadSubmit}
                  disabled={!uploadFile || uploadLoading}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {uploadLoading
                    ? <><Loader className="w-4 h-4 animate-spin" /> Uploading…</>
                    : <><Upload className="w-4 h-4" /> Upload & Parse</>
                  }
                </button>
                <button
                  onClick={closeUploadModal}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Step 2: Processing status + results */}
          {uploadResult && (
            <div className="flex flex-col gap-4">

              {/* Status banner */}
              {uploadResult.status === 'parsed' && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-700 text-sm font-medium">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  Resume parsed successfully!
                </div>
              )}
              {(uploadResult.status === 'queued' || uploadResult.status === 'processing') && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-700 text-sm font-medium">
                  <Loader className="w-4 h-4 shrink-0 animate-spin" />
                  AI is extracting information… this may take a few seconds.
                </div>
              )}
              {uploadResult.status === 'review_pending' && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Manual Review Required</p>
                    <p className="text-xs mt-0.5">{uploadResult.error_message}</p>
                  </div>
                </div>
              )}
              {uploadResult.status === 'failed' && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Parsing Failed</p>
                    <p className="text-xs mt-0.5">{uploadResult.error_message || 'An unexpected error occurred.'}</p>
                  </div>
                </div>
              )}

              {/* File info */}
              <div className="bg-slate-50 rounded-lg p-3 text-sm flex items-center gap-3">
                <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-slate-700 truncate">{uploadResult.original_filename}</p>
                  <p className="text-xs text-slate-500 capitalize">
                    {uploadResult.file_type?.toUpperCase()} ·{' '}
                    {(uploadResult.file_size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <span className={`ml-auto shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                  uploadResult.status === 'parsed'         ? 'bg-emerald-100 text-emerald-700' :
                  uploadResult.status === 'failed'         ? 'bg-rose-100 text-rose-700' :
                  uploadResult.status === 'review_pending' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {uploadResult.status.replace('_', ' ')}
                </span>
              </div>

              {/* Parsed data preview */}
              {uploadResult.parsed_data?.llm_output && Object.keys(uploadResult.parsed_data.llm_output).length > 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-700">Extracted Information</p>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      { label: 'Name',        value: uploadResult.parsed_data.llm_output.full_name },
                      { label: 'Email',       value: uploadResult.parsed_data.llm_output.email },
                      { label: 'Phone',       value: uploadResult.parsed_data.llm_output.phone },
                      { label: 'Designation', value: uploadResult.parsed_data.llm_output.designation },
                      { label: 'Company',     value: uploadResult.parsed_data.llm_output.current_company },
                      { label: 'Experience',  value: uploadResult.parsed_data.llm_output.experience_years != null
                          ? `${uploadResult.parsed_data.llm_output.experience_years} years` : null },
                    ].map(({ label, value }) => (
                      value ? (
                        <div key={label} className="bg-white border border-slate-200 rounded-lg p-2.5">
                          <p className="text-xs text-slate-500">{label}</p>
                          <p className="font-medium text-slate-800 mt-0.5 truncate">{value}</p>
                        </div>
                      ) : null
                    ))}
                  </div>

                  {uploadResult.parsed_data.llm_output.skills?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1.5">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {uploadResult.parsed_data.llm_output.skills.slice(0, 12).map((s, i) => (
                          <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                            {s}
                          </span>
                        ))}
                        {uploadResult.parsed_data.llm_output.skills.length > 12 && (
                          <span className="text-xs text-slate-400">
                            +{uploadResult.parsed_data.llm_output.skills.length - 12} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {uploadResult.parsed_data.llm_output.education?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1.5">Education</p>
                      <div className="flex flex-col gap-1.5">
                        {uploadResult.parsed_data.llm_output.education.map((e, i) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-lg p-2.5 text-sm">
                            <p className="font-medium text-slate-800">{e.degree}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{e.institution} {e.year ? `· ${e.year}` : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => { setUploadResult(null); setUploadFile(null); setUploadError(''); }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Upload Another
                </button>
                <button
                  onClick={closeUploadModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
