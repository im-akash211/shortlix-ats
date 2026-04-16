import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../lib/useDebounce';
import { useSearchParams, useNavigate, useMatch } from 'react-router-dom';
import { PageLoader } from '../components/LoadingDots';
import { Search, MapPin, Filter, X, ChevronDown, CheckCircle2, MoreHorizontal, Clock, XCircle, Trash2, Edit2 } from 'lucide-react';
import { requisitions as reqApi, departments as deptApi, users as usersApi, ai as aiApi } from '../lib/api';
import RichTextEditor from '../components/requisition/RichTextEditor';
import TagInput from '../components/requisition/TagInput';
import CandidateSignals from '../components/requisition/CandidateSignals';
import { ROUTES } from '../routes/constants';

const STATUS_ICON = {
  approved: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  pending_approval: <Clock className="w-4 h-4 text-amber-500" />,
  rejected: <XCircle className="w-4 h-4 text-rose-500" />,
  draft: <span className="w-4 h-4 bg-slate-300 rounded-full inline-block" />,
  closed: <XCircle className="w-4 h-4 text-slate-400" />,
};

const STATUS_COLORS = {
  approved: 'text-emerald-600',
  pending_approval: 'text-amber-600',
  rejected: 'text-rose-600',
  draft: 'text-slate-500',
  closed: 'text-slate-400',
};

const INITIAL_FORM = {
  title: '',
  department: '',
  sub_vertical_1: '',
  sub_vertical_2: '',
  location: '',
  designation: '',
  priority: 'medium',
  employment_type: 'permanent',
  requisition_type: 'new',
  purpose: '',
  client_name: '',
  positions_count: 1,
  experience_min: 0,
  experience_max: 3,
  job_description: '',
  roles_responsibilities: '',
  skills_required: [],
  skills_desirable: [],
  skills_to_evaluate: [],
  tags: [],
  min_qualification: '',
  expected_start_date: '',
  tat_days: '',
  budget: '',
  reference_number: '',
  project_name: '',
  hiring_manager: '',
  l1_approver: '',
  iit_grad: false,
  nit_grad: false,
  iim_grad: false,
  top_institute: false,
  female_diversity: false,
  unicorn_exp: false,
  top_internet_product: false,
  top_software_product: false,
  top_it_services_mnc: false,
  top_consulting_mnc: false,
};

function FieldLabel({ children, required }) {
  return (
    <label className="block text-sm font-semibold text-gray-700">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-0.5">{msg}</p>;
}

function SelectField({ value, onChange, children, error }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className={`w-full border rounded-lg p-2.5 text-sm outline-none appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? 'border-red-400' : 'border-gray-300'}`}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function TextField({ value, onChange, placeholder, type = 'text', error, ...rest }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? 'border-red-400' : 'border-gray-300'}`}
      {...rest}
    />
  );
}

export default function Requisitions({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-backed tab and search
  const activeTab = searchParams.get('tab') || 'My Requisitions';
  const setActiveTab = (val) => setSearchParams(p => { p.set('tab', val); return p; }, { replace: true });
  const search = searchParams.get('search') || '';
  const setSearch = (val) => setSearchParams(p => { if (val) p.set('search', val); else p.delete('search'); return p; }, { replace: true });

  // URL-backed modal routes
  const createMatch = useMatch(ROUTES.REQUISITIONS.NEW);
  const editMatch   = useMatch(ROUTES.REQUISITIONS.EDIT_PATTERN);
  const isCreateOpen = Boolean(createMatch);
  const isEditOpen   = Boolean(editMatch);

  const queryClient = useQueryClient();

  // Phase C debounce: local input state so typing is instant; URL (and fetch) only updates after 400ms pause
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 400);
  useEffect(() => {
    if (debouncedSearch !== search) setSearch(debouncedSearch);
  // intentionally omit `search` to avoid loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const [subVerticals1, setSubVerticals1] = useState([]);
  const [subVerticals2, setSubVerticals2] = useState([]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiCache, setAiCache] = useState(null);      // cached API result for the create form
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [createForm, setCreateForm] = useState(INITIAL_FORM);
  const [createLoading, setCreateLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [actionMenuId, setActionMenuId] = useState(null);

  // Edit requisition state — isEditOpen is URL-driven (see above)
  const [editingReq, setEditingReq] = useState(null);
  const [editForm, setEditForm] = useState(INITIAL_FORM);
  const [editLoading, setEditLoading] = useState(false);
  const [editErrors, setEditErrors] = useState({});
  const [editSubVerticals1, setEditSubVerticals1] = useState([]);
  const [editSubVerticals2, setEditSubVerticals2] = useState([]);

  // Delete requisition state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const setField = (key, val) => setCreateForm((f) => ({ ...f, [key]: val }));

  // Phase B+C: list cached per tab+search combination; placeholderData keeps previous results
  // visible while new filtered data loads — no blank-table flash on filter change.
  const reqQueryKey = ['requisitions', 'list', { tab: activeTab, search }];
  const { data: reqQueryData, isLoading: reqIsLoading, isPlaceholderData: reqIsPlaceholder } = useQuery({
    queryKey: reqQueryKey,
    queryFn: () => {
      const params = {};
      if (activeTab === 'My Requisitions') params.tab = 'mine';
      if (search) params.search = search;
      return reqApi.list(params);
    },
    placeholderData: (previousData) => previousData,
  });
  const loading = reqIsLoading || reqIsPlaceholder;

  const data  = reqQueryData ? (reqQueryData.results || reqQueryData) : [];
  const total = reqQueryData?.count ?? data.length;

  // Phase B: departments + users are session-stable — cached indefinitely, never refetched
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => deptApi.list(),
    staleTime: Infinity,
    select: (res) => res.results || res,
  });

  const { data: usersList = [] } = useQuery({
    queryKey: ['users', 'dropdown'],
    queryFn: () => usersApi.dropdown(),
    staleTime: Infinity,
    select: (res) => res.results || res,
  });

  // Sync edit URL route → load requisition data into edit form
  useEffect(() => {
    const reqId = editMatch?.params?.id;
    if (!reqId) return;
    setEditErrors({});
    reqApi.detail(reqId)
      .then((detail) => {
        setEditingReq(detail);
        setEditForm({
          title:               detail.title || '',
          department:          detail.department || '',
          sub_vertical_1:      detail.sub_vertical_1 || '',
          sub_vertical_2:      detail.sub_vertical_2 || '',
          location:            detail.location || '',
          designation:         detail.designation || '',
          priority:            detail.priority || 'medium',
          employment_type:     detail.employment_type || 'permanent',
          requisition_type:    detail.requisition_type || 'new',
          purpose:             detail.purpose || '',
          client_name:         detail.client_name || '',
          positions_count:     detail.positions_count || 1,
          experience_min:      detail.experience_min ?? 0,
          experience_max:      detail.experience_max ?? 2,
          job_description:     detail.job_description || '',
          roles_responsibilities: detail.roles_responsibilities || '',
          skills_required:     detail.skills_required || [],
          skills_desirable:    detail.skills_desirable || [],
          skills_to_evaluate:  detail.skills_to_evaluate || [],
          tags:                detail.tags || [],
          min_qualification:   detail.min_qualification || '',
          expected_start_date: detail.expected_start_date || '',
          tat_days:            detail.tat_days ?? '',
          budget:              detail.budget ?? '',
          reference_number:    detail.reference_number || '',
          project_name:        detail.project_name || '',
          hiring_manager:      detail.hiring_manager || '',
          l1_approver:         detail.l1_approver || '',
          iit_grad:            detail.iit_grad || false,
          nit_grad:            detail.nit_grad || false,
          iim_grad:            detail.iim_grad || false,
          top_institute:       detail.top_institute || false,
          female_diversity:    detail.female_diversity || false,
          unicorn_exp:         detail.unicorn_exp || false,
          top_internet_product:  detail.top_internet_product || false,
          top_software_product:  detail.top_software_product || false,
          top_it_services_mnc:   detail.top_it_services_mnc || false,
          top_consulting_mnc:    detail.top_consulting_mnc || false,
        });
        if (detail.department) {
          deptApi.subVerticals(detail.department, 'null')
            .then((res) => setEditSubVerticals1(res.results || res)).catch(console.error);
        }
        if (detail.sub_vertical_1) {
          deptApi.subVerticals(detail.department, detail.sub_vertical_1)
            .then((res) => setEditSubVerticals2(res.results || res)).catch(console.error);
        }
      })
      .catch(() => {
        alert('Failed to load requisition details');
        navigate(ROUTES.REQUISITIONS.ROOT, { replace: true });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMatch?.params?.id]);

  // When department changes: load SV1 and reset sub-verticals
  useEffect(() => {
    if (!createForm.department) {
      setSubVerticals1([]);
      setSubVerticals2([]);
      setField('sub_vertical_1', '');
      setField('sub_vertical_2', '');
      return;
    }
    deptApi.subVerticals(createForm.department, 'null')
      .then((res) => setSubVerticals1(res.results || res))
      .catch(console.error);
    setSubVerticals2([]);
    setField('sub_vertical_1', '');
    setField('sub_vertical_2', '');
  }, [createForm.department]);

  // When SV1 changes: load SV2
  useEffect(() => {
    if (!createForm.sub_vertical_1) {
      setSubVerticals2([]);
      setField('sub_vertical_2', '');
      return;
    }
    deptApi.subVerticals(createForm.department, createForm.sub_vertical_1)
      .then((res) => setSubVerticals2(res.results || res))
      .catch(console.error);
    setField('sub_vertical_2', '');
  }, [createForm.sub_vertical_1]);

  const validateForm = () => {
    const errs = {};
    if (!createForm.title) errs.title = 'Required';
    if (!createForm.department) errs.department = 'Required';
    if (!createForm.location) errs.location = 'Required';
    if (!createForm.purpose) errs.purpose = 'Required';
    if (createForm.purpose === 'client' && !createForm.client_name) errs.client_name = 'Required for client requisitions';
    if (!createForm.hiring_manager) errs.hiring_manager = 'Required';
    if (!createForm.l1_approver) errs.l1_approver = 'Required';
    if (createForm.skills_required.length < 3) errs.skills_required = 'Please add at least 3 mandatory skills';
    return errs;
  };

  const handleCreate = async () => {
    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setCreateLoading(true);
    try {
      const payload = { ...createForm, expected_start_date: createForm.expected_start_date || null };
      await reqApi.create(payload);
      handleCloseCreate();
      queryClient.invalidateQueries({ queryKey: ['requisitions', 'list'] });
    } catch (err) {
      alert(err.data?.detail || JSON.stringify(err.data) || 'Failed to create requisition');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCloseCreate = () => {
    navigate(ROUTES.REQUISITIONS.ROOT, { replace: true });
    setCreateForm(INITIAL_FORM);
    setSubVerticals1([]);
    setSubVerticals2([]);
    setFormErrors({});
    setAiGenerating(false);
    setAiCache(null);
    setAiGenerated(false);
    setAiError(null);
  };

  const handleAction = async (action, id) => {
    setActionMenuId(null);
    try {
      if (action === 'submit') await reqApi.submit(id);
      if (action === 'approve') await reqApi.approve(id);
      if (action === 'reject') await reqApi.reject(id);
      queryClient.invalidateQueries({ queryKey: ['requisitions', 'list'] });
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Action failed');
    }
  };

  // ── Edit requisition handlers ─────────────────────────────────────────────
  // Navigate to the edit URL; the useEffect above handles loading the form data
  const openEdit = (req) => {
    setActionMenuId(null);
    navigate(ROUTES.REQUISITIONS.EDIT(req.id));
  };

  const handleCloseEdit = () => {
    navigate(ROUTES.REQUISITIONS.ROOT, { replace: true });
    setEditingReq(null);
    setEditForm(INITIAL_FORM);
    setEditErrors({});
    setEditSubVerticals1([]);
    setEditSubVerticals2([]);
  };

  const setEditField = (key, val) => setEditForm((f) => ({ ...f, [key]: val }));

  const handleEditSave = async () => {
    const errs = {};
    if (!editForm.title) errs.title = 'Required';
    if (!editForm.department) errs.department = 'Required';
    if (!editForm.location) errs.location = 'Required';
    if (!editForm.hiring_manager) errs.hiring_manager = 'Required';
    if (!editForm.l1_approver) errs.l1_approver = 'Required';
    if (editForm.skills_required.length < 3) errs.skills_required = 'Please add at least 3 mandatory skills';
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }
    setEditLoading(true);
    try {
      const targetId = editingReq?.id || editMatch?.params?.id;
      await reqApi.update(targetId, editForm);
      handleCloseEdit();
      queryClient.invalidateQueries({ queryKey: ['requisitions', 'list'] });
    } catch (err) {
      alert(err.data?.detail || JSON.stringify(err.data) || 'Failed to update requisition');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Delete requisition handlers ───────────────────────────────────────────
  const openDeleteConfirm = (req) => {
    setActionMenuId(null);
    setDeleteTarget(req);
    setIsDeleteOpen(true);
  };

  const handleDeleteRequisition = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await reqApi.delete(deleteTarget.id);
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['requisitions', 'list'] });
    } catch (err) {
      alert(err.data?.detail || 'Failed to delete requisition');
    } finally {
      setDeleteLoading(false);
    }
  };

  const _applyAiResult = (result) => {
    setField('job_description', result.job_description || '');
    setField('roles_responsibilities', result.roles_and_responsibilities || '');
    if (result.required_skills?.length) setField('skills_required', result.required_skills);
    if (result.preferred_skills?.length) setField('skills_desirable', result.preferred_skills);
  };

  const _callAiGenerate = async () => {
    const deptName  = departments.find((d) => String(d.id) === String(createForm.department))?.name || createForm.department;
    const sv1Name   = subVerticals1.find((sv) => String(sv.id) === String(createForm.sub_vertical_1))?.name || '';
    const sv2Name   = subVerticals2.find((sv) => String(sv.id) === String(createForm.sub_vertical_2))?.name || '';

    setAiGenerating(true);
    setAiError(null);
    try {
      const result = await aiApi.generateRequisitionContent({
        department:        deptName,
        requisition_title: createForm.title,
        sub_vertical_1:    sv1Name,
        sub_vertical_2:    sv2Name,
        experience_min:    createForm.experience_min,
        experience_max:    createForm.experience_max,
      });
      setAiCache(result);
      setAiGenerated(true);
      _applyAiResult(result);
    } catch (err) {
      setAiError(err.data?.detail || err.message || 'AI generation failed. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleGenerateJd = async () => {
    if (aiCache) { _applyAiResult(aiCache); return; }
    await _callAiGenerate();
  };

  const handleGenerateRoles = async () => {
    if (aiCache) { _applyAiResult(aiCache); return; }
    await _callAiGenerate();
  };

  const handleRegenerateAll = async () => {
    setAiCache(null);
    setAiGenerated(false);
    await _callAiGenerate();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-medium">Manage your Requisitions</h1>
        <span className="text-sm">Welcome, {user?.full_name}</span>
      </div>

      <div className="p-6 flex flex-col gap-6 h-full overflow-hidden">
        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between px-6 border-b border-slate-200">
            <div className="flex gap-6">
              {['My Requisitions', 'All Requisitions'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate(ROUTES.REQUISITIONS.NEW)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
            >
              Create Requisition
            </button>
          </div>

          <div className="p-4 border-b border-slate-200 bg-white flex items-center gap-4">
            <div className="flex items-center border border-slate-300 rounded-md overflow-hidden bg-white w-96 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
                  placeholder="Search Keywords"
                  className="w-full px-3 py-2 text-sm outline-none"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
            <span className="text-xs text-slate-500">{total} requisitions</span>
          </div>

          <div className="overflow-auto flex-1">
            {loading ? (
              <PageLoader label="Loading requisitions…" />
            ) : (
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200">Requisition</th>
                    <th className="px-4 py-3 border-b border-slate-200">Status</th>
                    <th className="px-4 py-3 border-b border-slate-200">Purpose</th>
                    <th className="px-4 py-3 border-b border-slate-200">Department</th>
                    <th className="px-4 py-3 border-b border-slate-200">Created on</th>
                    <th className="px-4 py-3 border-b border-slate-200">Hiring Manager</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((req) => (
                    <tr key={req.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-800 text-sm hover:text-blue-600 cursor-pointer">{req.title}</span>
                          <span className="flex items-center gap-1.5 text-slate-500 text-xs"><MapPin className="w-3 h-3 text-slate-400" /> {req.location}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className={`flex items-center gap-1.5 font-medium capitalize ${STATUS_COLORS[req.status] || 'text-slate-600'}`}>
                          {STATUS_ICON[req.status]}
                          {req.status?.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        {req.purpose ? (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${req.purpose === 'client' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                            {req.purpose_code || req.purpose}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-4 align-top text-slate-600">{req.department_name}</td>
                      <td className="px-4 py-4 align-top text-slate-600">{new Date(req.created_at).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-4 align-top text-slate-600">{req.hiring_manager_name}</td>
                      <td className="px-4 py-4 align-top text-center relative">
                        <button
                          onClick={() => setActionMenuId(actionMenuId === req.id ? null : req.id)}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        {actionMenuId === req.id && (
                          <div className="absolute right-4 top-10 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px] text-left">
                            <button
                              onClick={() => openEdit(req)}
                              className="w-full px-4 py-2 text-sm hover:bg-slate-50 text-blue-600 flex items-center gap-2"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => openDeleteConfirm(req)}
                              className="w-full px-4 py-2 text-sm hover:bg-rose-50 text-rose-600 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                            <button onClick={() => setActionMenuId(null)} className="w-full px-4 py-2 text-sm hover:bg-slate-50 text-slate-400">Cancel</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && !loading && (
                    <tr><td colSpan={10} className="text-center py-16 text-slate-400">No requisitions found.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Create Requisition Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-sm">
            <div>
              <p className="text-xs text-gray-500">Requisitions &rsaquo; <span className="text-gray-700 font-medium">Create Requisition</span></p>
              <h1 className="text-xl font-bold text-gray-900 mt-0.5">Create Requisition</h1>
            </div>
            <button onClick={handleCloseCreate} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-5xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-8">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">

                {/* Row 1: Department | Sub Vertical 2 */}
                <div className="flex flex-col gap-1">
                  <FieldLabel required>Department:</FieldLabel>
                  <SelectField value={createForm.department} onChange={(e) => setField('department', e.target.value)} error={formErrors.department}>
                    <option value="">Select an option</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </SelectField>
                  <FieldError msg={formErrors.department} />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Requisition Title:</FieldLabel>
                  <TextField
                    value={createForm.title}
                    onChange={(e) => setField('title', e.target.value)}
                    placeholder="The title of requisition will be used later as job title"
                    error={formErrors.title}
                  />
                  <FieldError msg={formErrors.title} />
                </div>

                {/* Row 2: Sub Vertical 1 | Requisition Title */}
                <div className="flex flex-col gap-1">
                  <FieldLabel required>Sub Vertical 1:</FieldLabel>
                  <SelectField
                    value={createForm.sub_vertical_1}
                    onChange={(e) => setField('sub_vertical_1', e.target.value)}
                    disabled={!createForm.department}
                  >
                    <option value="">Select an option</option>
                    {subVerticals1.map((sv) => <option key={sv.id} value={sv.id}>{sv.name}</option>)}
                  </SelectField>
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Sub Vertical 2:</FieldLabel>
                  <SelectField
                    value={createForm.sub_vertical_2}
                    onChange={(e) => setField('sub_vertical_2', e.target.value)}
                    disabled={!createForm.sub_vertical_1}
                  >
                    <option value="">Select an option</option>
                    {subVerticals2.map((sv) => <option key={sv.id} value={sv.id}>{sv.name}</option>)}
                  </SelectField>
                </div>

                {/* Row 3: Requisition Description | Roles & Responsibilities */}
                <div className="flex flex-col gap-1">
                  <RichTextEditor
                    label="Requisition Description:"
                    required
                    value={createForm.job_description}
                    onChange={(val) => setField('job_description', val)}
                    onGenerate={handleRegenerateAll}
                    generating={aiGenerating}
                    aiGenerated={aiGenerated}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <RichTextEditor
                    label="Roles & Responsibilities:"
                    required
                    value={createForm.roles_responsibilities}
                    onChange={(val) => setField('roles_responsibilities', val)}
                    onGenerate={handleRegenerateAll}
                    generating={aiGenerating}
                    aiGenerated={aiGenerated}
                  />
                </div>

                {/* Row 4: Priority | Type of Employment */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>Priority:</FieldLabel>
                  <SelectField value={createForm.priority} onChange={(e) => setField('priority', e.target.value)}>
                    {['low', 'medium', 'high', 'critical'].map((p) => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </SelectField>
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel>Type of Employment:</FieldLabel>
                  <SelectField value={createForm.employment_type} onChange={(e) => setField('employment_type', e.target.value)}>
                    <option value="">--Select--</option>
                    <option value="permanent">Permanent</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </SelectField>
                </div>

                {/* Row 5: Requisition Type | Client's Name */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>Requisition Type:</FieldLabel>
                  <SelectField value={createForm.requisition_type} onChange={(e) => setField('requisition_type', e.target.value)}>
                    <option value="">--Select--</option>
                    <option value="new">New</option>
                    <option value="backfill">Backfill</option>
                  </SelectField>
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Purpose:</FieldLabel>
                  <SelectField value={createForm.purpose} onChange={(e) => { setField('purpose', e.target.value); if (e.target.value !== 'client') setField('client_name', ''); }} error={formErrors.purpose}>
                    <option value="">--Select--</option>
                    <option value="internal">Internal</option>
                    <option value="client">Client</option>
                  </SelectField>
                  <FieldError msg={formErrors.purpose} />
                </div>

                {createForm.purpose === 'client' && (
                  <div className="flex flex-col gap-1">
                    <FieldLabel required>Client's Name:</FieldLabel>
                    <TextField
                      value={createForm.client_name}
                      onChange={(e) => setField('client_name', e.target.value)}
                      placeholder="Enter client name"
                      error={formErrors.client_name}
                    />
                    <FieldError msg={formErrors.client_name} />
                  </div>
                )}

                {/* Row 6: Location */}
                <div className="flex flex-col gap-1">
                  <FieldLabel required>Location:</FieldLabel>
                  <select
                    value={createForm.location}
                    onChange={(e) => setField('location', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select location...</option>
                    <option value="Gurgaon">Gurgaon</option>
                    <option value="Noida">Noida</option>
                    <option value="Remote">Remote</option>
                  </select>
                  <FieldError msg={formErrors.location} />
                </div>

                {/* Row 7: blank | Years of Experience */}
                <div />

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Years Of Experience:</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={createForm.experience_min}
                      onChange={(e) => setField('experience_min', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50"
                    />
                    <span className="text-gray-500 text-sm shrink-0">to</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={createForm.experience_max}
                      onChange={(e) => setField('experience_max', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50"
                    />
                    <span className="text-gray-500 text-sm shrink-0">Years</span>
                  </div>
                </div>

                {/* Row 8: Designation | Open Positions */}
                <div className="flex flex-col gap-1">
                  <FieldLabel required>Designation:</FieldLabel>
                  <TextField
                    value={createForm.designation}
                    onChange={(e) => setField('designation', e.target.value)}
                    placeholder="Designation"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Open Positions:</FieldLabel>
                  <TextField
                    type="number"
                    min="1"
                    value={createForm.positions_count}
                    onChange={(e) => setField('positions_count', e.target.value)}
                    placeholder="No of positions required"
                  />
                </div>

                {/* Row 9: Expected Start Date | Reference Number */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>Expected Start date:</FieldLabel>
                  <TextField
                    type="date"
                    value={createForm.expected_start_date}
                    onChange={(e) => setField('expected_start_date', e.target.value)}
                    placeholder="Click to Set Date"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel>Reference Number:</FieldLabel>
                  <TextField
                    value={createForm.reference_number}
                    onChange={(e) => setField('reference_number', e.target.value)}
                    placeholder="Reference Number"
                  />
                </div>

                {/* TAT (Turn Around Time) */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>TAT (Days):</FieldLabel>
                  <TextField
                    type="number"
                    min="1"
                    value={createForm.tat_days}
                    onChange={(e) => setField('tat_days', e.target.value)}
                    placeholder="e.g. 30"
                  />
                </div>

                {/* Budget */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>Budget (₹ Lakhs):</FieldLabel>
                  <TextField
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.budget}
                    onChange={(e) => setField('budget', e.target.value)}
                    placeholder="e.g. 12.50 (optional)"
                  />
                </div>

                {/* Row 10: Tags | Mandatory Skills */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>Tags:</FieldLabel>
                  <TagInput
                    value={createForm.tags}
                    onChange={(val) => setField('tags', val)}
                    placeholder="Tag your jobs with popular keywords"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Mandatory Skills:</FieldLabel>
                  <TagInput
                    value={createForm.skills_required}
                    onChange={(val) => setField('skills_required', val)}
                    placeholder="Please add at least 3 comma separated mandatory skills."
                    error={formErrors.skills_required}
                  />
                  <FieldError msg={formErrors.skills_required} />
                </div>

                {/* Row 11: Desirable Skills | Skills To Be Evaluated On */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>Desirable Skills:</FieldLabel>
                  <TagInput
                    value={createForm.skills_desirable}
                    onChange={(val) => setField('skills_desirable', val)}
                    placeholder="Comma separated nice-to-have skills."
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel>Skills To Be Evaluated On:</FieldLabel>
                  <TagInput
                    value={createForm.skills_to_evaluate}
                    onChange={(val) => setField('skills_to_evaluate', val)}
                    placeholder="Comma separated skills to evaluate candidates on."
                  />
                </div>

                {/* Row 12: Hiring Manager | Project Name */}
                <div className="flex flex-col gap-1">
                  <FieldLabel required>Hiring Manager:</FieldLabel>
                  <SelectField value={createForm.hiring_manager} onChange={(e) => setField('hiring_manager', e.target.value)} error={formErrors.hiring_manager}>
                    <option value="">Hiring Manager</option>
                    {usersList.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </SelectField>
                  <FieldError msg={formErrors.hiring_manager} />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Project Name:</FieldLabel>
                  <TextField
                    value={createForm.project_name}
                    onChange={(e) => setField('project_name', e.target.value)}
                    placeholder=""
                  />
                </div>

                {/* Row 13: Qualifications | Level 1 Approval */}
                <div className="flex flex-col gap-1">
                  <FieldLabel required>Qualifications:</FieldLabel>
                  <TextField
                    value={createForm.min_qualification}
                    onChange={(e) => setField('min_qualification', e.target.value)}
                    placeholder=""
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Level 1 Approval:</FieldLabel>
                  <SelectField value={createForm.l1_approver} onChange={(e) => setField('l1_approver', e.target.value)} error={formErrors.l1_approver}>
                    <option value="">--Select--</option>
                    {usersList.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </SelectField>
                  <FieldError msg={formErrors.l1_approver} />
                </div>

                {/* Row 14: Candidate Signals (full width) */}
                <div className="col-span-2 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <FieldLabel>Candidate Signals</FieldLabel>
                    <span className="text-gray-400 cursor-help text-sm" title="Select signals to prioritize candidates with specific backgrounds">ℹ</span>
                  </div>
                  <CandidateSignals
                    values={createForm}
                    onChange={(key, val) => setField(key, val)}
                  />
                </div>

              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  {aiError && (
                    <p className="text-xs text-red-500">{aiError}</p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleCloseCreate}
                    className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-8 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={createLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-8 py-2.5 rounded-md text-sm font-medium transition-colors shadow-sm"
                  >
                    {createLoading ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ EDIT REQUISITION MODAL ══════════ */}
      {isEditOpen && editingReq && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-sm">
            <div>
              <p className="text-xs text-gray-500">Requisitions &rsaquo; <span className="text-gray-700 font-medium">Edit Requisition</span></p>
              <h1 className="text-xl font-bold text-gray-900 mt-0.5">Edit: {editingReq.title}</h1>
            </div>
            <button onClick={handleCloseEdit} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable body — same grid layout as Create */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-5xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-8">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Dep:</FieldLabel>
                  <SelectField value={editForm.department} onChange={(e) => { setEditField('department', e.target.value); deptApi.subVerticals(e.target.value, 'null').then((r) => setEditSubVerticals1(r.results || r)).catch(console.error); setEditSubVerticals2([]); setEditField('sub_vertical_1', ''); setEditField('sub_vertical_2', ''); }} error={editErrors.department}>
                    <option value="">Select an option</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </SelectField>
                  <FieldError msg={editErrors.department} />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel>Sub Vertical 2:</FieldLabel>
                  <SelectField value={editForm.sub_vertical_2} onChange={(e) => setEditField('sub_vertical_2', e.target.value)} disabled={!editForm.sub_vertical_1}>
                    <option value="">Select an option</option>
                    {editSubVerticals2.map((sv) => <option key={sv.id} value={sv.id}>{sv.name}</option>)}
                  </SelectField>
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel>Sub Vertical 1:</FieldLabel>
                  <SelectField value={editForm.sub_vertical_1} onChange={(e) => { setEditField('sub_vertical_1', e.target.value); deptApi.subVerticals(editForm.department, e.target.value).then((r) => setEditSubVerticals2(r.results || r)).catch(console.error); setEditField('sub_vertical_2', ''); }} disabled={!editForm.department}>
                    <option value="">Select an option</option>
                    {editSubVerticals1.map((sv) => <option key={sv.id} value={sv.id}>{sv.name}</option>)}
                  </SelectField>
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Requisition Title:</FieldLabel>
                  <TextField value={editForm.title} onChange={(e) => setEditField('title', e.target.value)} placeholder="Requisition title" error={editErrors.title} />
                  <FieldError msg={editErrors.title} />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel>Priority:</FieldLabel>
                  <SelectField value={editForm.priority} onChange={(e) => setEditField('priority', e.target.value)}>
                    {['low','medium','high','critical'].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                  </SelectField>
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel>Type of Employment:</FieldLabel>
                  <SelectField value={editForm.employment_type} onChange={(e) => setEditField('employment_type', e.target.value)}>
                    <option value="permanent">Permanent</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </SelectField>
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Purpose:</FieldLabel>
                  <SelectField value={editForm.purpose} onChange={(e) => setEditField('purpose', e.target.value)}>
                    <option value="">--Select--</option>
                    <option value="internal">Internal</option>
                    <option value="client">Client</option>
                  </SelectField>
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Location:</FieldLabel>
                  <select
                    value={editForm.location}
                    onChange={(e) => setEditField('location', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select location...</option>
                    <option value="Gurgaon">Gurgaon</option>
                    <option value="Noida">Noida</option>
                    <option value="Remote">Remote</option>
                  </select>
                  <FieldError msg={editErrors.location} />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Designation:</FieldLabel>
                  <TextField value={editForm.designation} onChange={(e) => setEditField('designation', e.target.value)} placeholder="Designation" />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Open Positions:</FieldLabel>
                  <TextField type="number" min="1" value={editForm.positions_count} onChange={(e) => setEditField('positions_count', e.target.value)} />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Years Of Experience:</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" step="0.5" value={editForm.experience_min} onChange={(e) => setEditField('experience_min', e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50" />
                    <span className="text-gray-500 text-sm shrink-0">to</span>
                    <input type="number" min="0" step="0.5" value={editForm.experience_max} onChange={(e) => setEditField('experience_max', e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50" />
                    <span className="text-gray-500 text-sm shrink-0">Years</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Hiring Manager:</FieldLabel>
                  <SelectField value={editForm.hiring_manager} onChange={(e) => setEditField('hiring_manager', e.target.value)} error={editErrors.hiring_manager}>
                    <option value="">Hiring Manager</option>
                    {usersList.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </SelectField>
                  <FieldError msg={editErrors.hiring_manager} />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Level 1 Approval:</FieldLabel>
                  <SelectField value={editForm.l1_approver} onChange={(e) => setEditField('l1_approver', e.target.value)} error={editErrors.l1_approver}>
                    <option value="">--Select--</option>
                    {usersList.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </SelectField>
                  <FieldError msg={editErrors.l1_approver} />
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                  <FieldLabel required>Mandatory Skills:</FieldLabel>
                  <TagInput value={editForm.skills_required} onChange={(val) => setEditField('skills_required', val)} placeholder="Please add at least 3 comma separated mandatory skills." error={editErrors.skills_required} />
                  <FieldError msg={editErrors.skills_required} />
                </div>

                {/* TAT (Turn Around Time) */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>TAT (Days):</FieldLabel>
                  <TextField
                    type="number"
                    min="1"
                    value={editForm.tat_days}
                    onChange={(e) => setEditField('tat_days', e.target.value)}
                    placeholder="e.g. 30"
                  />
                </div>

                {/* Budget */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>Budget (₹ Lakhs):</FieldLabel>
                  <TextField
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.budget}
                    onChange={(e) => setEditField('budget', e.target.value)}
                    placeholder="e.g. 12.50 (optional)"
                  />
                </div>

              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-gray-100">
                <button onClick={handleCloseEdit} className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-8 py-2.5 rounded-md text-sm font-medium transition-colors">Cancel</button>
                <button onClick={handleEditSave} disabled={editLoading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-8 py-2.5 rounded-md text-sm font-medium transition-colors shadow-sm">
                  {editLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ DELETE REQUISITION CONFIRMATION MODAL ══════════ */}
      {isDeleteOpen && deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[440px] max-w-[92vw] p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Delete Requisition</h3>
                <p className="text-xs text-slate-500 mt-0.5">{deleteTarget.title}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete <span className="font-semibold text-slate-800">{deleteTarget.title}</span>? This action{' '}
              <span className="font-semibold text-rose-600">cannot be undone</span>.
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
                onClick={handleDeleteRequisition}
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
