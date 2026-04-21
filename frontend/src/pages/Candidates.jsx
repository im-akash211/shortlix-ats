import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../lib/useDebounce';
import { useSearchParams, useNavigate, useMatch } from 'react-router-dom';
import { PageLoader } from '../components/LoadingDots';
import {
  Search, Edit, MapPin, Phone, Mail, Filter, Trash2,
  MessageSquarePlus, X, ChevronDown, ChevronUp, Briefcase, User, Clock,
  Upload, CheckCircle, AlertCircle, Loader, FileText, Plus, GraduationCap,
  ArrowUpDown, ArrowUp, ArrowDown, Share2,
} from 'lucide-react';
import { candidates as candidatesApi, jobs as jobsApi, resumes as resumesApi, candidateShare as candidateShareApi, users as usersApi } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { ROUTES } from '../routes/constants';

// ─── Skill chip editor ─────────────────────────────────────────────────────────
function SkillTagInput({ skills, onChange }) {
  const [inputVal, setInputVal] = useState('');

  const addSkill = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed]);
    }
    setInputVal('');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {skills.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs font-medium">
            {s}
            <button type="button" onClick={() => onChange(skills.filter((_, j) => j !== i))} className="hover:text-rose-500 transition-colors ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {skills.length === 0 && <span className="text-xs text-slate-400 italic">No skills added yet</span>}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
          placeholder="Type a skill and press Enter…"
          className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <button type="button" onClick={addSkill} className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

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
    <div className="border-b border-slate-200 last:border-b-0">
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
export default function Candidates({ user: _userProp }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-backed list state
  const search = searchParams.get('search') || '';
  const setSearch = (val) => setSearchParams(p => { if (val) p.set('search', val); else p.delete('search'); return p; }, { replace: true });

  // URL-backed filters — join arrays to stable string primitives for useCallback deps.
  // getAll() returns a new array reference each render which would cause infinite loops.
  const urlSources  = searchParams.getAll('source');
  const urlStages   = searchParams.getAll('stage');
  const urlJob      = searchParams.get('job') || '';
  const sourcesKey  = urlSources.join(',');   // stable primitive for deps
  const stagesKey   = urlStages.join(',');    // stable primitive for deps

  // URL-backed exp/date filters (moved from local state so clear/sync works consistently)
  const expMin   = searchParams.get('exp_min')   || '';
  const expMax   = searchParams.get('exp_max')   || '';
  const dateFrom = searchParams.get('date_from') || '';
  const dateTo   = searchParams.get('date_to')   || '';
  const setExpFilter   = (key, val) => setSearchParams(p => { if (val) p.set(key, val); else p.delete(key); return p; }, { replace: true });

  // URL-backed sort — field name prefixed with '-' for descending (DRF convention)
  const sortKey  = searchParams.get('sort') || '-created_at';
  const setSort  = (field) => {
    const next = sortKey === field ? `-${field}` : field;
    setSearchParams(p => { p.set('sort', next); return p; }, { replace: true });
  };

  // Column-header filter dropdown state (purely local UI — no data dependency)
  const [colDropdown, setColDropdown] = useState(null); // 'status' | 'source' | null
  const colDropdownRef = useRef(null);
  useEffect(() => {
    if (!colDropdown) return;
    const handler = (e) => { if (colDropdownRef.current && !colDropdownRef.current.contains(e.target)) setColDropdown(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colDropdown]);

  // URL-backed modal routes
  const viewMatch = useMatch(ROUTES.CANDIDATES.DETAIL_PATTERN);
  const editMatch = useMatch(ROUTES.CANDIDATES.EDIT_PATTERN);
  const routeCandidateId = viewMatch?.params?.candidateId || editMatch?.params?.candidateId;

  const queryClient = useQueryClient();

  // Phase C debounce: local input state so typing is instant; URL (and fetch) only updates after 400ms pause
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 400);
  useEffect(() => {
    if (debouncedSearch !== search) setSearch(debouncedSearch);
  // intentionally omit `search` to avoid loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Modal state — 'upload', 'review', 'note', 'move' remain local; 'view'/'edit' are URL-driven
  const [activeModal, setActiveModal]           = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  // View profile
  const [profileDetail, setProfileDetail]   = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Resume viewer
  const [resumeModal, setResumeModal] = useState(null); // { url, filename, type, name } | { empty/missing/error }
  const openResume = async (c) => {
    try {
      const detail = await candidatesApi.detail(c.id);
      const files = detail.resume_files || [];
      const latest = files.find(f => f.is_latest) || files[0];

      if (files.length === 0) {
        setResumeModal({ name: c.full_name, empty: true });
        return;
      }
      if (!latest?.file_url) {
        setResumeModal({ name: c.full_name, missing: true });
        return;
      }

      setResumeModal({ url: latest.file_url, filename: latest.original_filename, type: latest.file_type, name: c.full_name });
    } catch (err) {
      setResumeModal({ name: c.full_name, error: true });
    }
  };

  // Share popover
  const [shareOpen, setShareOpen]         = useState(null); // candidate id
  const [sharePos, setSharePos]           = useState({ top: 0, left: 0 });
  const [shareSearch, setShareSearch]     = useState('');
  const [shareSelected, setShareSelected] = useState([]);
  const [usersList, setUsersList]         = useState([]);
  const [usersLoading, setUsersLoading]   = useState(false);
  const [shareToast, setShareToast]       = useState(null);
  const shareRef                          = useRef(null);

  const openShare = (e, candidateId) => {
    setShareOpen(candidateId);
    setShareSearch('');
    setShareSelected([]);
  };

  useEffect(() => {
    if (!shareOpen) return;
    if (usersList.length === 0) {
      setUsersLoading(true);
      usersApi.dropdown()
        .then(res => setUsersList(Array.isArray(res) ? res : (res.results || [])))
        .catch(console.error)
        .finally(() => setUsersLoading(false));
    }
    const handler = (e) => { if (shareRef.current && !shareRef.current.contains(e.target)) { setShareOpen(null); setShareSearch(''); setShareSelected([]); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareOpen]);

  // Edit modal
  const [editForm, setEditForm]       = useState({});
  const [editLoading, setEditLoading] = useState(false);

  // Sync URL route → modal open/close for view and edit
  useEffect(() => {
    if (routeCandidateId) {
      const targetModal = editMatch ? 'edit' : 'view';
      setActiveModal(targetModal);
      setProfileDetail(null);
      setProfileLoading(true);
      candidatesApi.detail(routeCandidateId)
        .then((detail) => {
          setSelectedCandidate(detail);
          setProfileDetail(detail);
          if (editMatch) {
            setEditForm({
              full_name:                   detail.full_name || '',
              email:                       detail.email || '',
              phone:                       detail.phone || '',
              location:                    detail.location || '',
              native_location:             detail.native_location || '',
              designation:                 detail.designation || '',
              current_employer:            detail.current_employer || '',
              total_experience_years:      detail.total_experience_years ?? '',
              tenth_board:                 detail.tenth_board || '',
              tenth_percentage:            detail.tenth_percentage ?? '',
              twelfth_board:               detail.twelfth_board || '',
              twelfth_percentage:          detail.twelfth_percentage ?? '',
              graduation_course:           detail.graduation_course || '',
              graduation_college:          detail.graduation_college || '',
              graduation_year:             detail.graduation_year ?? '',
              graduation_percentage:       detail.graduation_percentage ?? '',
              qualifying_exam:             detail.qualifying_exam || '',
              qualifying_rank:             detail.qualifying_rank || '',
              post_graduation_course:      detail.post_graduation_course || '',
              post_graduation_college:     detail.post_graduation_college || '',
              post_graduation_year:        detail.post_graduation_year ?? '',
              post_graduation_percentage:  detail.post_graduation_percentage ?? '',
              post_qualifying_exam:        detail.post_qualifying_exam || '',
              post_qualifying_rank:        detail.post_qualifying_rank || '',
              ctc_fixed_lakhs:             detail.ctc_fixed_lakhs ?? '',
              ctc_variable_lakhs:          detail.ctc_variable_lakhs ?? '',
              current_ctc_lakhs:           detail.current_ctc_lakhs ?? '',
              expected_ctc_lakhs:          detail.expected_ctc_lakhs ?? '',
              offers_in_hand:              detail.offers_in_hand || '',
              notice_period_days:          detail.notice_period_days ?? '',
              notice_period_status:        detail.notice_period_status || '',
              reason_for_change:           detail.reason_for_change || '',
            });
          }
        })
        .catch(console.error)
        .finally(() => setProfileLoading(false));
    } else if (activeModal === 'view' || activeModal === 'edit') {
      setActiveModal(null);
      setSelectedCandidate(null);
      setProfileDetail(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCandidateId, editMatch]);

  // Note modal
  const [noteText, setNoteText]       = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  // Move modal — allJobs cached via React Query (see below)
  const [moveJobId, setMoveJobId] = useState('');

  // (exp/date filters are now URL-backed — see above)

  // Upload Resume modal (Phase 1)
  const [uploadFile, setUploadFile]         = useState(null);
  const [uploadLoading, setUploadLoading]   = useState(false);
  const [uploadResult, setUploadResult]     = useState(null); // ingestion record
  const [uploadError, setUploadError]       = useState('');
  const [uploadDuplicate, setUploadDuplicate] = useState(null); // 409 duplicate payload
  const fileInputRef                        = useRef(null);
  const pollIntervalRef                     = useRef(null);

  // Review modal (Phase 2)
  const BLANK_REVIEW = { first_name: '', last_name: '', email: '', phone: '', designation: '', current_company: '', experience_years: '', skills: [], education: [] };
  const [reviewIngestion, setReviewIngestion]   = useState(null);
  const [reviewForm, setReviewForm]             = useState(BLANK_REVIEW);
  const [reviewLoading, setReviewLoading]       = useState(false);
  const [reviewSaved, setReviewSaved]           = useState(false);
  const [convertLoading, setConvertLoading]     = useState(false);
  const [duplicateInfo, setDuplicateInfo]       = useState(null); // {candidate, match_type}
  const [resolveLoading, setResolveLoading]     = useState(false);
  const [convertSuccess, setConvertSuccess]     = useState(null); // created candidate
  const [reviewError, setReviewError]           = useState('');

  // Delete candidate
  const [isDeleteOpen, setIsDeleteOpen]         = useState(false);
  const [deleteTarget, setDeleteTarget]         = useState(null);
  const [deleteLoading, setDeleteLoading]       = useState(false);

  const activeFilterCount =
    urlSources.length +
    urlStages.length +
    (urlJob ? 1 : 0) +
    (expMin ? 1 : 0) + (expMax ? 1 : 0) +
    (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  // ── Phase B+C: candidates list — cached per filter combination; previous data shown during filter changes ──
  const candidatesQueryKey = ['candidates', 'list', { search, sources: sourcesKey, stages: stagesKey, job: urlJob, exp_min: expMin, exp_max: expMax, date_from: dateFrom, date_to: dateTo, sort: sortKey }];
  const { data: candidatesQueryData, isLoading: loading } = useQuery({
    queryKey: candidatesQueryKey,
    queryFn: () => {
      const params = { page_size: 500 };
      if (search)     params.search    = search;
      if (sourcesKey) params.source    = sourcesKey;
      if (stagesKey)  params.stage     = stagesKey;
      if (urlJob)     params.job       = urlJob;
      if (expMin)     params.exp_min   = expMin;
      if (expMax)     params.exp_max   = expMax;
      if (dateFrom)   params.date_from = dateFrom;
      if (dateTo)     params.date_to   = dateTo;
      if (sortKey)    params.ordering  = sortKey;
      return candidatesApi.list(params);
    },
    placeholderData: (previousData) => previousData,
  });

  const data  = candidatesQueryData ? (candidatesQueryData.results || candidatesQueryData) : [];
  const total = candidatesQueryData?.count ?? data.length;

  // Phase B: all jobs cached (for Move modal + Job filter dropdown) — stable across session
  const { data: allJobs = [] } = useQuery({
    queryKey: ['jobs', 'all'],
    queryFn: () => jobsApi.list({ page_size: 200 }),
    staleTime: Infinity,
    select: (res) => res.results || res,
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const openModal = (type, candidate) => {
    if (type === 'edit') {
      // URL-driven: navigate to /candidates/:id/edit
      navigate(ROUTES.CANDIDATES.EDIT(candidate.id));
      return;
    }
    setSelectedCandidate(candidate);
    setActiveModal(type);
    setNoteText('');
    setMoveJobId('');
  };

  const openViewProfile = (candidate) => {
    navigate(ROUTES.CANDIDATES.PROFILE(candidate.id));
  };

  const closeModal = () => {
    // For URL-driven modals, navigate back; for local modals, clear state directly
    if (activeModal === 'view' || activeModal === 'edit') {
      navigate(ROUTES.CANDIDATES.ROOT, { replace: true });
    } else {
      setActiveModal(null);
      setSelectedCandidate(null);
      setProfileDetail(null);
    }
  };

  const toggleArrayFilter = (key, value) => {
    setSearchParams(prev => {
      const current = prev.getAll(key);
      prev.delete(key);
      if (current.includes(value)) {
        current.filter(v => v !== value).forEach(v => prev.append(key, v));
      } else {
        [...current, value].forEach(v => prev.append(key, v));
      }
      return prev;
    }, { replace: true });
  };

  const clearAllFilters = () => {
    setSearchParams(prev => {
      ['source', 'stage', 'job', 'exp_min', 'exp_max', 'date_from', 'date_to'].forEach(k => prev.delete(k));
      return prev;
    }, { replace: true });
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput); };

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
      const toNum = (v) => (v !== '' && v != null ? Number(v) : null);
      const payload = {
        ...editForm,
        total_experience_years:     toNum(editForm.total_experience_years),
        tenth_percentage:           toNum(editForm.tenth_percentage),
        twelfth_percentage:         toNum(editForm.twelfth_percentage),
        graduation_year:            toNum(editForm.graduation_year),
        graduation_percentage:      toNum(editForm.graduation_percentage),
        post_graduation_year:       toNum(editForm.post_graduation_year),
        post_graduation_percentage: toNum(editForm.post_graduation_percentage),
        ctc_fixed_lakhs:            toNum(editForm.ctc_fixed_lakhs),
        ctc_variable_lakhs:         toNum(editForm.ctc_variable_lakhs),
        current_ctc_lakhs:          toNum(editForm.current_ctc_lakhs),
        expected_ctc_lakhs:         toNum(editForm.expected_ctc_lakhs),
        notice_period_days:         toNum(editForm.notice_period_days),
      };
      await candidatesApi.update(selectedCandidate.id, payload);
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['candidates', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['candidate', selectedCandidate.id] });
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
      queryClient.invalidateQueries({ queryKey: ['candidates', 'list'] });
    } catch (err) {
      alert(err.data?.error || 'Failed to move candidate');
    }
  };

  const openDeleteConfirm = (candidate) => {
    setDeleteTarget(candidate);
    setIsDeleteOpen(true);
  };

  const handleDeleteCandidate = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await candidatesApi.delete(deleteTarget.id);
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      // Close view profile modal if we just deleted the viewed candidate
      if (activeModal === 'view' && selectedCandidate?.id === deleteTarget.id) closeModal();
      queryClient.invalidateQueries({ queryKey: ['candidates', 'list'] });
    } catch (err) {
      alert(err.data?.detail || 'Failed to delete candidate');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Upload resume handlers ─────────────────────────────────────────────────
  const openUploadModal = () => {
    setUploadFile(null);
    setUploadResult(null);
    setUploadError('');
    setUploadDuplicate(null);
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
    setUploadDuplicate(null);
  };

  // ── Phase 2: Review handlers ───────────────────────────────────────────────
  const openReviewModal = (ingestion) => {
    const data = ingestion.parsed_data?.reviewed_output || ingestion.parsed_data?.llm_output || {};
    setReviewIngestion(ingestion);
    setReviewForm({
      first_name:       data.first_name       ?? '',
      last_name:        data.last_name        ?? '',
      email:            data.email            ?? '',
      phone:            data.phone            ?? '',
      designation:      data.designation      ?? '',
      current_company:  data.current_company  ?? '',
      experience_years: data.experience_years ?? '',
      skills:           Array.isArray(data.skills) ? data.skills : [],
      education:        Array.isArray(data.education) ? data.education : [],
    });
    setReviewSaved(ingestion.status === 'reviewed');
    setDuplicateInfo(null);
    setConvertSuccess(null);
    setReviewError('');
    setActiveModal('review');
  };

  const closeReviewModal = () => {
    setActiveModal(null);
    setReviewIngestion(null);
    setDuplicateInfo(null);
    setConvertSuccess(null);
    setReviewError('');
  };

  const setReviewField = (field, value) =>
    setReviewForm(prev => ({ ...prev, [field]: value }));

  const updateEducation = (idx, field, value) =>
    setReviewForm(prev => ({
      ...prev,
      education: prev.education.map((e, i) => i === idx ? { ...e, [field]: value } : e),
    }));

  const addEducation = () =>
    setReviewForm(prev => ({
      ...prev,
      education: [...prev.education, { degree: '', institution: '', year: '' }],
    }));

  const removeEducation = (idx) =>
    setReviewForm(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== idx),
    }));

  const handleSaveReview = async () => {
    if (!reviewIngestion) return;
    setReviewLoading(true);
    setReviewError('');
    try {
      const payload = {
        ...reviewForm,
        experience_years: reviewForm.experience_years !== '' ? Number(reviewForm.experience_years) : null,
      };
      await resumesApi.review(reviewIngestion.id, payload);
      setReviewSaved(true);
      setReviewIngestion(prev => ({ ...prev, status: 'reviewed' }));
    } catch (err) {
      setReviewError(err.data?.detail || JSON.stringify(err.data) || 'Failed to save review.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!reviewIngestion) return;
    setConvertLoading(true);
    setReviewError('');
    try {
      const result = await resumesApi.convert(reviewIngestion.id);
      if (result.status === 'duplicate_found') {
        setDuplicateInfo({ candidate: result.duplicate_candidate, matchType: result.match_type });
      } else {
        setConvertSuccess(result.candidate);
        queryClient.invalidateQueries({ queryKey: ['candidates', 'list'] });
      }
    } catch (err) {
      setReviewError(err.data?.detail || 'Conversion failed.');
    } finally {
      setConvertLoading(false);
    }
  };

  const handleResolveDuplicate = async (decision) => {
    if (!reviewIngestion) return;
    setResolveLoading(true);
    setReviewError('');
    try {
      const result = await resumesApi.resolveDuplicate(reviewIngestion.id, decision);
      if (decision === 'discard') {
        closeReviewModal();
      } else {
        setConvertSuccess(result.candidate);
        setDuplicateInfo(null);
        queryClient.invalidateQueries({ queryKey: ['candidates', 'list'] });
      }
    } catch (err) {
      setReviewError(err.data?.detail || 'Failed to resolve duplicate.');
    } finally {
      setResolveLoading(false);
    }
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
    setUploadDuplicate(null);
    try {
      const record = await resumesApi.upload(uploadFile);
      setUploadResult(record);
      // Poll for status updates until terminal state
      if (!['parsed', 'failed', 'review_pending'].includes(record.status)) {
        startPolling(record.id);
      }
    } catch (err) {
      if (err.status === 409 && err.data?.duplicate) {
        setUploadDuplicate(err.data);
      } else {
        const msg = err.data?.file?.[0] || err.data?.detail || err.message || 'Upload failed';
        setUploadError(msg);
      }
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
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
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
                onClick={clearAllFilters}
                className="text-xs text-blue-600 hover:underline font-medium shrink-0"
              >
                Clear Filters ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1">
            {loading ? (
              <PageLoader label="Loading candidates…" />
            ) : (
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-10 shadow-sm" ref={colDropdownRef}>
                  <tr>
                    {/* Applicant — sortable */}
                    <th className="px-2 py-1 border-b border-slate-200 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSort('full_name')}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          Applicant
                          {sortKey === 'full_name' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : sortKey === '-full_name' ? <ArrowDown className="w-3 h-3 text-blue-600" /> : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                        </button>
                      </div>
                    </th>

                    {/* Job Applied */}
                    <th className="px-2 py-1 border-b border-slate-200 text-xs">Job Applied</th>

                    {/* Status — filterable via dropdown */}
                    <th className="px-2 py-1 border-b border-slate-200 text-xs">
                      <div className="relative">
                        <button
                          onClick={() => setColDropdown(colDropdown === 'status' ? null : 'status')}
                          className={`flex items-center gap-1 hover:text-blue-600 transition-colors ${urlStages.length > 0 ? 'text-blue-600' : ''}`}
                        >
                          Status
                          {urlStages.length > 0 && <span className="bg-blue-600 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{urlStages.length}</span>}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {colDropdown === 'status' && (
                          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-30 min-w-[180px] py-1">
                            {Object.entries(STAGE_LABELS).map(([key, label]) => (
                              <label key={key} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs font-normal text-slate-700">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 accent-blue-600"
                                  checked={urlStages.includes(key)}
                                  onChange={() => toggleArrayFilter('stage', key)}
                                />
                                {label}
                              </label>
                            ))}
                            {urlStages.length > 0 && (
                              <button
                                onClick={() => { setSearchParams(p => { p.delete('stage'); return p; }, { replace: true }); setColDropdown(null); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-rose-500 hover:bg-rose-50 border-t border-slate-100 mt-1"
                              >
                                Clear filter
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </th>

                    {/* Source — filterable via dropdown */}
                    <th className="px-2 py-1 border-b border-slate-200 text-xs">
                      <div className="relative">
                        <button
                          onClick={() => setColDropdown(colDropdown === 'source' ? null : 'source')}
                          className={`flex items-center gap-1 hover:text-blue-600 transition-colors ${urlSources.length > 0 ? 'text-blue-600' : ''}`}
                        >
                          Source
                          {urlSources.length > 0 && <span className="bg-blue-600 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{urlSources.length}</span>}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {colDropdown === 'source' && (
                          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-30 min-w-[180px] py-1">
                            {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                              <label key={key} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs font-normal text-slate-700">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 accent-blue-600"
                                  checked={urlSources.includes(key)}
                                  onChange={() => toggleArrayFilter('source', key)}
                                />
                                {label}
                              </label>
                            ))}
                            {urlSources.length > 0 && (
                              <button
                                onClick={() => { setSearchParams(p => { p.delete('source'); return p; }, { replace: true }); setColDropdown(null); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-rose-500 hover:bg-rose-50 border-t border-slate-100 mt-1"
                              >
                                Clear filter
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </th>

                    {/* Date Added — sortable */}
                    <th className="px-2 py-1 border-b border-slate-200 text-xs">
                      <button
                        onClick={() => setSort('created_at')}
                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                      >
                        Date Added
                        {sortKey === 'created_at' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : sortKey === '-created_at' ? <ArrowDown className="w-3 h-3 text-blue-600" /> : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </button>
                    </th>

                    <th className="px-3 py-1.5 border-b border-slate-200 text-xs text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((c) => (
                    <tr key={c.id} className="hover:bg-blue-50/50 transition-colors cursor-pointer" onClick={() => openViewProfile(c)}>

                      {/* Applicant cell */}
                      <td className="px-2 py-1.5 align-top">
                        <div className="flex items-start gap-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-800 text-xs">
                              {c.full_name?.toUpperCase()}
                            </span>
                            <div className="flex flex-col gap-0 text-slate-500 text-xs leading-[1.25]">
                              <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5 text-slate-400" /> {c.phone || '—'}</span>
                              <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5 text-slate-400" /> {c.email}</span>
                              <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5 text-slate-400" /> {c.location || '—'}</span>
                              <span className="flex items-center gap-1"><Briefcase className="w-2.5 h-2.5 text-slate-400" /> {c.total_experience_years ? `${c.total_experience_years} Yrs` : '—'}</span>
                            </div>
                            {/* Action icons */}
                            <div className="flex items-center gap-2 text-slate-400">
                              <button onClick={(e) => { e.stopPropagation(); openResume(c); }} className="hover:text-blue-600 transition-colors" title="View Resume"><FileText className="w-3.5 h-3.5" /></button>
                              <button onClick={(e) => { e.stopPropagation(); openModal('note', c); }} className="hover:text-blue-600 transition-colors" title="Add Note"><MessageSquarePlus className="w-3.5 h-3.5" /></button>
                              <button onClick={(e) => { e.stopPropagation(); openModal('edit', c); }} className="hover:text-blue-600 transition-colors" title="Edit Profile"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(c); }} className="hover:text-rose-600 transition-colors" title="Delete Candidate"><Trash2 className="w-3.5 h-3.5" /></button>
                              {/* Share */}
                              <button onClick={(e) => { e.stopPropagation(); openShare(e, shareOpen === c.id ? null : c.id); }} className="hover:text-blue-600 transition-colors" title="Share Profile"><Share2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Job Applied */}
                      <td className="px-2 py-1.5 align-top">
                        {c.current_job ? (
                          <div className="flex flex-col text-xs">
                            <span className="text-slate-700">{c.current_job.title}</span>
                            <span className="text-slate-500">({c.current_job.job_code})</span>
                          </div>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-2 py-1.5 align-top">
                        {c.current_stage ? (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STAGE_COLORS[c.current_stage] || 'bg-slate-100 text-slate-600'}`}>
                            {STAGE_LABELS[c.current_stage] || c.current_stage}
                          </span>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>

                      {/* Source */}
                      <td className="px-2 py-1.5 align-top">
                        <span className="text-slate-700 font-medium text-xs">
                          {SOURCE_LABELS[c.source] || c.source || '—'}
                        </span>
                      </td>

                      {/* Date Added */}
                      <td className="px-3 py-1.5 align-top text-slate-600 text-xs">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB') : '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-1.5 align-top text-center">
                        <button
                          onClick={() => openModal('move', c)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded text-xs font-medium transition-colors shadow-sm"
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
        </div>{/* end filter sidebar */}
      </div>

      {/* ══════════ VIEW PROFILE MODAL ══════════ */}
      <Modal isOpen={activeModal === 'view'} onClose={closeModal} title="Candidate Profile" maxWidth="max-w-3xl">
        {profileLoading ? (
          <PageLoader label="Loading profile…" />
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
              <button
                onClick={() => openResume(profileDetail)}
                className="shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Resume
              </button>
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

            {/* CTC + Notice Period (admin/recruiter only) */}
            {(user?.role === 'admin' || user?.role === 'recruiter') && (profileDetail?.current_ctc_lakhs != null || profileDetail?.notice_period_days != null) && (
              <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl px-4 py-3">
                {profileDetail?.current_ctc_lakhs != null && (
                  <div className="flex items-start gap-2.5">
                    <span className="text-slate-400 mt-0.5 shrink-0"><Briefcase className="w-4 h-4" /></span>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Current CTC</p>
                      <p className="text-sm font-medium text-slate-800">₹{profileDetail.current_ctc_lakhs} L</p>
                    </div>
                  </div>
                )}
                {profileDetail?.notice_period_days != null && (
                  <div className="flex items-start gap-2.5">
                    <span className="text-slate-400 mt-0.5 shrink-0"><Clock className="w-4 h-4" /></span>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Notice Period</p>
                      <p className="text-sm font-medium text-slate-800">{profileDetail.notice_period_days} days</p>
                    </div>
                  </div>
                )}
              </div>
            )}

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
              <button
                onClick={() => { closeModal(); openDeleteConfirm(profileDetail); }}
                className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto"
              >
                <Trash2 className="w-4 h-4" /> Delete
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
      <Modal isOpen={activeModal === 'edit'} onClose={closeModal} title="Edit Profile" maxWidth="max-w-3xl">
        {selectedCandidate && (
          <div className="flex flex-col gap-6 max-h-[75vh] overflow-y-auto pr-1">

            {/* Basic Info */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Basic Information</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Full Name *</label>
                  <input type="text" value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Email</label>
                  <input type="email" value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Phone Number</label>
                  <input type="text" value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Designation</label>
                  <input type="text" value={editForm.designation}
                    onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Current Employer</label>
                  <input type="text" value={editForm.current_employer}
                    onChange={(e) => setEditForm({ ...editForm, current_employer: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Total Experience (years)</label>
                  <input type="number" step="0.1" min="0" value={editForm.total_experience_years}
                    onChange={(e) => setEditForm({ ...editForm, total_experience_years: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Current Location</label>
                  <input type="text" value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Native Location</label>
                  <input type="text" value={editForm.native_location}
                    onChange={(e) => setEditForm({ ...editForm, native_location: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>

            {/* Education */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Education</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">10th Board</label>
                  <input type="text" value={editForm.tenth_board}
                    onChange={(e) => setEditForm({ ...editForm, tenth_board: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">10th %</label>
                  <input type="number" step="0.01" min="0" max="100" value={editForm.tenth_percentage}
                    onChange={(e) => setEditForm({ ...editForm, tenth_percentage: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">12th Board</label>
                  <input type="text" value={editForm.twelfth_board}
                    onChange={(e) => setEditForm({ ...editForm, twelfth_board: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">12th %</label>
                  <input type="number" step="0.01" min="0" max="100" value={editForm.twelfth_percentage}
                    onChange={(e) => setEditForm({ ...editForm, twelfth_percentage: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Graduation Course</label>
                  <input type="text" value={editForm.graduation_course}
                    onChange={(e) => setEditForm({ ...editForm, graduation_course: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Graduation College</label>
                  <input type="text" value={editForm.graduation_college}
                    onChange={(e) => setEditForm({ ...editForm, graduation_college: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Graduation Year</label>
                  <input type="number" min="1980" max="2100" value={editForm.graduation_year}
                    onChange={(e) => setEditForm({ ...editForm, graduation_year: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Graduation %</label>
                  <input type="number" step="0.01" min="0" max="100" value={editForm.graduation_percentage}
                    onChange={(e) => setEditForm({ ...editForm, graduation_percentage: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Qualifying Exam (UG)</label>
                  <input type="text" value={editForm.qualifying_exam}
                    onChange={(e) => setEditForm({ ...editForm, qualifying_exam: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Qualifying Rank (UG)</label>
                  <input type="text" value={editForm.qualifying_rank}
                    onChange={(e) => setEditForm({ ...editForm, qualifying_rank: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Post Graduation Course</label>
                  <input type="text" value={editForm.post_graduation_course}
                    onChange={(e) => setEditForm({ ...editForm, post_graduation_course: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Post Graduation College</label>
                  <input type="text" value={editForm.post_graduation_college}
                    onChange={(e) => setEditForm({ ...editForm, post_graduation_college: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Post Graduation Year</label>
                  <input type="number" min="1980" max="2100" value={editForm.post_graduation_year}
                    onChange={(e) => setEditForm({ ...editForm, post_graduation_year: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Post Graduation %</label>
                  <input type="number" step="0.01" min="0" max="100" value={editForm.post_graduation_percentage}
                    onChange={(e) => setEditForm({ ...editForm, post_graduation_percentage: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Qualifying Exam (PG)</label>
                  <input type="text" value={editForm.post_qualifying_exam}
                    onChange={(e) => setEditForm({ ...editForm, post_qualifying_exam: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Qualifying Rank (PG)</label>
                  <input type="text" value={editForm.post_qualifying_rank}
                    onChange={(e) => setEditForm({ ...editForm, post_qualifying_rank: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>

            {/* CTC & Employment */}
            {(user?.role === 'admin' || user?.role === 'recruiter') && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">CTC &amp; Employment</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-700">CTC Fixed (Lakhs)</label>
                    <input type="number" min="0" step="0.1" value={editForm.ctc_fixed_lakhs}
                      onChange={(e) => setEditForm({ ...editForm, ctc_fixed_lakhs: e.target.value })}
                      className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-700">CTC Variable (Lakhs)</label>
                    <input type="number" min="0" step="0.1" value={editForm.ctc_variable_lakhs}
                      onChange={(e) => setEditForm({ ...editForm, ctc_variable_lakhs: e.target.value })}
                      className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-700">Current CTC (Lakhs)</label>
                    <input type="number" min="0" step="0.1" value={editForm.current_ctc_lakhs}
                      onChange={(e) => setEditForm({ ...editForm, current_ctc_lakhs: e.target.value })}
                      className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-700">Expected CTC (Lakhs)</label>
                    <input type="number" min="0" step="0.1" value={editForm.expected_ctc_lakhs}
                      onChange={(e) => setEditForm({ ...editForm, expected_ctc_lakhs: e.target.value })}
                      className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-700">Notice Period (days)</label>
                    <input type="number" min="0" step="1" value={editForm.notice_period_days}
                      onChange={(e) => setEditForm({ ...editForm, notice_period_days: e.target.value })}
                      className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-700">Notice Period Status</label>
                    <select value={editForm.notice_period_status}
                      onChange={(e) => setEditForm({ ...editForm, notice_period_status: e.target.value })}
                      className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500 bg-white">
                      <option value="">— Select —</option>
                      <option value="serving">Serving</option>
                      <option value="lwd">LWD</option>
                      <option value="notice">In Notice</option>
                    </select>
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-700">Offers in Hand</label>
                    <textarea rows={2} value={editForm.offers_in_hand}
                      onChange={(e) => setEditForm({ ...editForm, offers_in_hand: e.target.value })}
                      className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500 resize-none"
                      placeholder="e.g. Offer from Accenture @ 18L" />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-700">Reason for Change</label>
                    <textarea rows={2} value={editForm.reason_for_change}
                      onChange={(e) => setEditForm({ ...editForm, reason_for_change: e.target.value })}
                      className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500 resize-none" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 sticky bottom-0 bg-white pb-1">
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

      {/* ══════════ REVIEW RESUME MODAL (Phase 2) ══════════ */}
      <Modal isOpen={activeModal === 'review'} onClose={closeReviewModal} title="Review Extracted Information" maxWidth="max-w-3xl">
        {convertSuccess ? (
          /* ── Conversion success ── */
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-800">Candidate Added to Talent Pool!</p>
              <p className="text-sm text-slate-500 mt-1">
                <span className="font-medium text-slate-700">{convertSuccess.full_name}</span> is now in the talent pool.
              </p>
            </div>
            <button
              onClick={() => { closeReviewModal(); queryClient.invalidateQueries({ queryKey: ['candidates', 'list'] }); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-md text-sm font-medium transition-colors"
            >
              View in Talent Pool
            </button>
          </div>
        ) : duplicateInfo ? (
          /* ── Duplicate found ── */
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">Duplicate Candidate Found</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Matched by <span className="font-semibold">{duplicateInfo.matchType?.replace(/_/g, ' ')}</span>.
                  Please choose how to proceed.
                </p>
              </div>
            </div>

            {/* Existing candidate preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Existing Candidate</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { label: 'Name',        value: duplicateInfo.candidate.full_name },
                  { label: 'Email',       value: duplicateInfo.candidate.email },
                  { label: 'Phone',       value: duplicateInfo.candidate.phone || '—' },
                  { label: 'Designation', value: duplicateInfo.candidate.designation || '—' },
                  { label: 'Company',     value: duplicateInfo.candidate.current_employer || '—' },
                  { label: 'Source',      value: duplicateInfo.candidate.source || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white border border-slate-200 rounded-lg p-2.5">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="font-medium text-slate-800 truncate">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {reviewError && (
              <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{reviewError}</p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleResolveDuplicate('merge')}
                disabled={resolveLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
              >
                {resolveLoading ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : 'Merge with Existing'}
              </button>
              <button
                onClick={() => handleResolveDuplicate('force_create')}
                disabled={resolveLoading || duplicateInfo.matchType === 'email'}
                title={duplicateInfo.matchType === 'email' ? 'Cannot force-create when email matches exactly' : ''}
                className="flex-1 bg-slate-600 hover:bg-slate-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
              >
                Force Create
              </button>
              <button
                onClick={() => handleResolveDuplicate('discard')}
                disabled={resolveLoading}
                className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        ) : (
          /* ── Edit form ── */
          <div className="flex flex-col gap-5">

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              {[['first_name', 'First Name'], ['last_name', 'Last Name']].map(([field, label]) => (
                <div key={field} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">{label}</label>
                  <input
                    type="text" value={reviewForm[field]}
                    onChange={e => setReviewField(field, e.target.value)}
                    className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>

            {/* Contact row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Email <span className="text-rose-500">*</span></label>
                <input
                  type="email" value={reviewForm.email}
                  onChange={e => setReviewField('email', e.target.value)}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Phone</label>
                <input
                  type="text" value={reviewForm.phone}
                  onChange={e => setReviewField('phone', e.target.value)}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Professional row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Designation</label>
                <input
                  type="text" value={reviewForm.designation}
                  onChange={e => setReviewField('designation', e.target.value)}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Current Company</label>
                <input
                  type="text" value={reviewForm.current_company}
                  onChange={e => setReviewField('current_company', e.target.value)}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Experience */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Total Experience (years)</label>
              <input
                type="number" min="0" step="0.5" value={reviewForm.experience_years}
                onChange={e => setReviewField('experience_years', e.target.value)}
                className="w-40 border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            {/* Skills */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Skills</label>
              <SkillTagInput
                skills={reviewForm.skills}
                onChange={skills => setReviewField('skills', skills)}
              />
            </div>

            {/* Education */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" /> Education
                </label>
                <button
                  type="button" onClick={addEducation}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {reviewForm.education.length === 0 && (
                <p className="text-xs text-slate-400 italic">No education entries.</p>
              )}
              {reviewForm.education.map((edu, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 relative">
                  <button
                    type="button" onClick={() => removeEducation(idx)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {[['degree', 'Degree'], ['institution', 'Institution'], ['year', 'Year']].map(([f, l]) => (
                    <div key={f} className="flex flex-col gap-1">
                      <label className="text-xs text-slate-500">{l}</label>
                      <input
                        type="text" value={edu[f]}
                        onChange={e => updateEducation(idx, f, e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Reviewed status badge */}
            {reviewSaved && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-emerald-700 text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" />
                Review saved. Click &ldquo;Save to Talent Pool&rdquo; to create the candidate.
              </div>
            )}

            {reviewError && (
              <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{reviewError}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-100 flex-wrap">
              <button
                onClick={handleSaveReview}
                disabled={reviewLoading}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {reviewLoading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Save Reviewed Data
              </button>
              <button
                onClick={handleConvert}
                disabled={convertLoading || !reviewSaved}
                title={!reviewSaved ? 'Save reviewed data first' : ''}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {convertLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Save to Talent Pool
              </button>
              <button
                onClick={closeReviewModal}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-sm font-medium transition-colors ml-auto"
              >
                Cancel
              </button>
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

              {uploadDuplicate && (
                <div className="flex flex-col gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                  <div className="flex items-start gap-2 text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <div>
                      <p className="font-semibold">Duplicate Resume Detected</p>
                      <p className="text-amber-700 mt-0.5">
                        This exact file has already been uploaded — even if the filename is different.
                      </p>
                    </div>
                  </div>
                  <div className="bg-white border border-amber-100 rounded-lg px-4 py-3 flex flex-col gap-1.5 text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Status</span>
                      <span className="text-xs font-medium capitalize text-slate-700">
                        {uploadDuplicate.existing_status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Uploaded</span>
                      <span className="text-xs font-medium text-slate-700">
                        {new Date(uploadDuplicate.uploaded_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Record ID</span>
                      <span className="text-xs font-mono text-slate-500 truncate max-w-[180px]">
                        {uploadDuplicate.existing_resume_id}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-amber-700">
                    To re-upload, please ask an admin to remove the existing record first.
                  </p>
                </div>
              )}

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
                      { label: 'Name',        value: [uploadResult.parsed_data.llm_output.first_name, uploadResult.parsed_data.llm_output.last_name].filter(Boolean).join(' ') || null },
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

              <div className="flex items-center gap-3 pt-2 border-t border-slate-100 flex-wrap">
                {uploadResult.status === 'parsed' && (
                  <button
                    onClick={() => { closeUploadModal(); openReviewModal(uploadResult); }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    <Edit className="w-4 h-4" /> Review &amp; Edit
                  </button>
                )}
                <button
                  onClick={() => { setUploadResult(null); setUploadFile(null); setUploadError(''); }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Upload Another
                </button>
                <button
                  onClick={closeUploadModal}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ══════════ SHARE MODAL ══════════ */}
      {/* Share success toast */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] bg-green-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          {shareToast}
        </div>
      )}

      {shareOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div ref={shareRef} className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Share Candidate Profile</h3>
              <button onClick={() => { setShareOpen(null); setShareSearch(''); setShareSelected([]); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Search */}
            <div className="px-5 py-3 border-b border-slate-100">
              <input autoFocus type="text" placeholder="Search users..." value={shareSearch} onChange={e => setShareSearch(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
            </div>
            {/* User list */}
            <div className="overflow-y-auto max-h-64">
              {usersLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                  <svg className="animate-spin w-4 h-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                  <span className="text-xs">Loading users...</span>
                </div>
              ) : usersList.filter(u => u.full_name.toLowerCase().includes(shareSearch.toLowerCase())).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No users found</p>
              ) : usersList.filter(u => u.full_name.toLowerCase().includes(shareSearch.toLowerCase())).map(u => (
                <label key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0">
                  <input type="checkbox" checked={shareSelected.includes(u.id)} onChange={() => setShareSelected(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} className="accent-blue-600 w-4 h-4 shrink-0" />
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                    {u.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{u.full_name}</p>
                    <p className="text-xs text-slate-400 capitalize">{u.role?.replace('_', ' ')}</p>
                  </div>
                </label>
              ))}
            </div>
            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">{shareSelected.length > 0 ? `${shareSelected.length} user${shareSelected.length > 1 ? 's' : ''} selected` : 'Select users to share with'}</span>
              <div className="flex gap-2">
                <button onClick={() => { setShareOpen(null); setShareSearch(''); setShareSelected([]); }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                <button
                  disabled={shareSelected.length === 0}
                  onClick={async () => {
                    const count = shareSelected.length;
                    try {
                      await candidateShareApi.share(shareOpen, shareSelected);
                      setShareToast(`Profile shared with ${count} user${count > 1 ? 's' : ''} successfully`);
                      setTimeout(() => setShareToast(null), 3000);
                    } catch (err) { console.error(err); }
                    setShareOpen(null); setShareSearch(''); setShareSelected([]);
                  }}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors font-medium"
                >
                  Share{shareSelected.length > 0 ? ` (${shareSelected.length})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ RESUME VIEWER MODAL ══════════ */}
      <Modal isOpen={!!resumeModal} onClose={() => setResumeModal(null)} title={resumeModal ? `Resume — ${resumeModal.name}` : ''} maxWidth="max-w-4xl">
        {resumeModal && (
          resumeModal.error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
              <FileText className="w-16 h-16 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Failed to load resume.</p>
              <p className="text-xs text-slate-400">Please try again later.</p>
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

      {/* ══════════ DELETE CANDIDATE CONFIRMATION MODAL ══════════ */}
      {isDeleteOpen && deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[440px] max-w-[92vw] p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Delete Candidate</h3>
                <p className="text-xs text-slate-500 mt-0.5">{deleteTarget.full_name}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete <span className="font-semibold text-slate-800">{deleteTarget.full_name}</span>? This action{' '}
              <span className="font-semibold text-rose-600">cannot be undone</span> and will remove all associated data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setIsDeleteOpen(false); setDeleteTarget(null); }}
                disabled={deleteLoading}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCandidate}
                disabled={deleteLoading}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {deleteLoading ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
