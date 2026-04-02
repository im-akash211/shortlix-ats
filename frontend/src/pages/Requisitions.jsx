import React, { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Filter, X, ChevronDown, CheckCircle2, MoreHorizontal, Clock, XCircle } from 'lucide-react';
import { requisitions as reqApi, departments as deptApi, users as usersApi } from '../lib/api';
import RichTextEditor from '../components/requisition/RichTextEditor';
import TagInput from '../components/requisition/TagInput';
import CandidateSignals from '../components/requisition/CandidateSignals';

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
  client_name: '',
  positions_count: 1,
  experience_min: 0,
  experience_max: 3,
  ctc_currency: 'INR',
  ctc_min_lakhs: '',
  ctc_max_lakhs: '',
  job_description: '',
  roles_responsibilities: '',
  skills_required: [],
  skills_desirable: [],
  skills_to_evaluate: [],
  tags: [],
  min_qualification: '',
  expected_start_date: '',
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
  const [activeTab, setActiveTab] = useState('My Requisitions');
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [subVerticals1, setSubVerticals1] = useState([]);
  const [subVerticals2, setSubVerticals2] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isRolesGenerating, setIsRolesGenerating] = useState(false);
  const [createForm, setCreateForm] = useState(INITIAL_FORM);
  const [createLoading, setCreateLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [actionMenuId, setActionMenuId] = useState(null);

  const setField = (key, val) => setCreateForm((f) => ({ ...f, [key]: val }));

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (activeTab === 'My Requisitions') params.tab = 'mine';
    if (search) params.search = search;
    reqApi.list(params)
      .then((res) => {
        setData(res.results || res);
        setTotal(res.count || (res.results || res).length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    deptApi.list().then((res) => setDepartments(res.results || res)).catch(console.error);
    usersApi.dropdown().then((res) => setUsersList(res.results || res)).catch(console.error);
  }, []);

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
      await reqApi.create(createForm);
      handleCloseCreate();
      load();
    } catch (err) {
      alert(err.data?.detail || JSON.stringify(err.data) || 'Failed to create requisition');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setCreateForm(INITIAL_FORM);
    setSubVerticals1([]);
    setSubVerticals2([]);
    setFormErrors({});
    setIsAiGenerating(false);
    setIsRolesGenerating(false);
  };

  const handleAction = async (action, id) => {
    setActionMenuId(null);
    try {
      if (action === 'submit') await reqApi.submit(id);
      if (action === 'approve') await reqApi.approve(id);
      if (action === 'reject') await reqApi.reject(id);
      load();
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Action failed');
    }
  };

  const handleGenerateJd = () => {
    setIsAiGenerating(true);
    setTimeout(() => {
      const jd = `<p><strong>Job Title:</strong> ${createForm.title || 'Position'}</p><p>We are looking for a talented ${createForm.title || 'candidate'} to join our team.</p><ul><li>Drive key initiatives and contribute to team goals</li><li>Collaborate with cross-functional teams</li><li>Deliver high quality results</li></ul><p><strong>Skills Required:</strong></p><ul><li>Strong problem-solving ability</li><li>Excellent communication skills</li><li>Relevant domain expertise</li></ul>`;
      setField('job_description', jd);
      setIsAiGenerating(false);
    }, 1200);
  };

  const handleGenerateRoles = () => {
    setIsRolesGenerating(true);
    setTimeout(() => {
      const roles = `<p>To succeed in this role – you should have the following:</p><ul><li>Proficiency in relevant technologies and tools</li><li>Strong understanding of best practices and design principles</li><li>Ability to communicate effectively and work well in a team environment</li><li>A keen eye for detail and a passion for creating quality outcomes</li></ul>`;
      setField('roles_responsibilities', roles);
      setIsRolesGenerating(false);
    }, 1200);
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
              onClick={() => setIsCreateOpen(true)}
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
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && load()}
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
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>
            ) : (
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200">Requisition</th>
                    <th className="px-4 py-3 border-b border-slate-200">Status</th>
                    <th className="px-4 py-3 border-b border-slate-200">Department</th>
                    <th className="px-4 py-3 border-b border-slate-200">Created on</th>
                    <th className="px-4 py-3 border-b border-slate-200">Hiring Manager</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center">Applies</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center">Shortlists</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center">Offers</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center">Joined</th>
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
                      <td className="px-4 py-4 align-top text-slate-600">{req.department_name}</td>
                      <td className="px-4 py-4 align-top text-slate-600">{new Date(req.created_at).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-4 align-top text-slate-600">{req.hiring_manager_name}</td>
                      <td className="px-4 py-4 align-top text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-slate-100 text-slate-700 font-semibold">{req.applies_count ?? 0}</span>
                      </td>
                      <td className="px-4 py-4 align-top text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-blue-50 text-blue-700 font-semibold">{req.shortlists_count ?? 0}</span>
                      </td>
                      <td className="px-4 py-4 align-top text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-slate-100 text-slate-700 font-semibold">{req.offers_count ?? 0}</span>
                      </td>
                      <td className="px-4 py-4 align-top text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-slate-100 text-slate-700 font-semibold">{req.joined_count ?? 0}</span>
                      </td>
                      <td className="px-4 py-4 align-top text-center relative">
                        <button
                          onClick={() => setActionMenuId(actionMenuId === req.id ? null : req.id)}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        {actionMenuId === req.id && (
                          <div className="absolute right-4 top-10 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px] text-left">
                            {req.status === 'draft' && (
                              <button onClick={() => handleAction('submit', req.id)} className="w-full px-4 py-2 text-sm hover:bg-slate-50 text-slate-700">Submit for Approval</button>
                            )}
                            {req.status === 'pending_approval' && user?.role !== 'recruiter' && (
                              <>
                                <button onClick={() => handleAction('approve', req.id)} className="w-full px-4 py-2 text-sm hover:bg-slate-50 text-emerald-600">Approve</button>
                                <button onClick={() => handleAction('reject', req.id)} className="w-full px-4 py-2 text-sm hover:bg-slate-50 text-rose-600">Reject</button>
                              </>
                            )}
                            <button onClick={() => setActionMenuId(null)} className="w-full px-4 py-2 text-sm hover:bg-slate-50 text-slate-500">Cancel</button>
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
                  <FieldLabel required>Dep:</FieldLabel>
                  <SelectField value={createForm.department} onChange={(e) => setField('department', e.target.value)} error={formErrors.department}>
                    <option value="">Select an option</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </SelectField>
                  <FieldError msg={formErrors.department} />
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
                  <FieldLabel required>Requisition Title:</FieldLabel>
                  <TextField
                    value={createForm.title}
                    onChange={(e) => setField('title', e.target.value)}
                    placeholder="The title of requisition will be used later as job title"
                    error={formErrors.title}
                  />
                  <FieldError msg={formErrors.title} />
                </div>

                {/* Row 3: Requisition Description | Roles & Responsibilities */}
                <div className="flex flex-col gap-1">
                  <RichTextEditor
                    label="Requisition Description:"
                    required
                    value={createForm.job_description}
                    onChange={(val) => setField('job_description', val)}
                    onGenerate={handleGenerateJd}
                    generating={isAiGenerating}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <RichTextEditor
                    label="Roles & Responsibilities:"
                    required
                    value={createForm.roles_responsibilities}
                    onChange={(val) => setField('roles_responsibilities', val)}
                    onGenerate={handleGenerateRoles}
                    generating={isRolesGenerating}
                  />
                </div>

                {/* Row 4: Priority | Type of Employment */}
                <div className="flex flex-col gap-1">
                  <FieldLabel required>Priority:</FieldLabel>
                  <SelectField value={createForm.priority} onChange={(e) => setField('priority', e.target.value)}>
                    {['low', 'medium', 'high', 'critical'].map((p) => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </SelectField>
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Type of Employment:</FieldLabel>
                  <SelectField value={createForm.employment_type} onChange={(e) => setField('employment_type', e.target.value)}>
                    <option value="">--Select--</option>
                    <option value="permanent">Permanent</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </SelectField>
                </div>

                {/* Row 5: Requisition Type | Client's Name */}
                <div className="flex flex-col gap-1">
                  <FieldLabel required>Requisition Type:</FieldLabel>
                  <SelectField value={createForm.requisition_type} onChange={(e) => setField('requisition_type', e.target.value)}>
                    <option value="">--Select--</option>
                    <option value="new">New</option>
                    <option value="backfill">Backfill</option>
                  </SelectField>
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Client's Name:</FieldLabel>
                  <TextField
                    value={createForm.client_name}
                    onChange={(e) => setField('client_name', e.target.value)}
                    placeholder=""
                  />
                </div>

                {/* Row 6: Location | Annual CTC Range */}
                <div className="flex flex-col gap-1">
                  <FieldLabel required>Location:</FieldLabel>
                  <TextField
                    value={createForm.location}
                    onChange={(e) => setField('location', e.target.value)}
                    placeholder="Can be multiple comma separated locations"
                    error={formErrors.location}
                  />
                  <FieldError msg={formErrors.location} />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>
                    Annual CTC Range
                    <span className="ml-1 text-gray-400 cursor-help" title="CTC in Lakhs per annum">ℹ</span>
                  </FieldLabel>
                  <div className="flex items-center gap-2">
                    <div className="relative w-20 shrink-0">
                      <select
                        value={createForm.ctc_currency}
                        onChange={(e) => setField('ctc_currency', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none appearance-none bg-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="INR">INR</option>
                        <option value="USD">USD</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={createForm.ctc_min_lakhs}
                      onChange={(e) => setField('ctc_min_lakhs', e.target.value)}
                      placeholder="Min CTC"
                      className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-500 text-sm shrink-0">to</span>
                    <input
                      type="number"
                      min="0"
                      value={createForm.ctc_max_lakhs}
                      onChange={(e) => setField('ctc_max_lakhs', e.target.value)}
                      placeholder="Max CTC"
                      className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
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
                  <FieldLabel required>Expected Start date:</FieldLabel>
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
                  <FieldLabel required>Desirable Skills:</FieldLabel>
                  <TagInput
                    value={createForm.skills_desirable}
                    onChange={(val) => setField('skills_desirable', val)}
                    placeholder="Comma separated nice-to-have skills."
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Skills To Be Evaluated On:</FieldLabel>
                  <TagInput
                    value={createForm.skills_to_evaluate}
                    onChange={(val) => setField('skills_to_evaluate', val)}
                    placeholder="Tag your jobs with popular keywords"
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
              <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-gray-100">
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
      )}
    </div>
  );
}
