import React, { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Filter, X, ChevronDown, CheckCircle2, MoreHorizontal, Clock, XCircle } from 'lucide-react';
import { requisitions as reqApi, departments as deptApi } from '../lib/api';

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

export default function Requisitions({ user }) {
  const [activeTab, setActiveTab] = useState('My Requisitions');
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [generatedJd, setGeneratedJd] = useState('');
  const [createForm, setCreateForm] = useState({
    title: '', department: '', location: '', designation: '',
    priority: 'medium', employment_type: 'permanent', requisition_type: 'new',
    positions_count: 1, experience_min: 0, experience_max: 3,
    job_description: '', hiring_manager: '', l1_approver: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);

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
  }, []);

  const handleCreate = async () => {
    if (!createForm.title || !createForm.department) return;
    setCreateLoading(true);
    try {
      const payload = {
        ...createForm,
        hiring_manager: createForm.hiring_manager || user?.id,
        l1_approver: createForm.l1_approver || user?.id,
      };
      await reqApi.create(payload);
      setIsCreateOpen(false);
      setCreateForm({ title: '', department: '', location: '', designation: '', priority: 'medium', employment_type: 'permanent', requisition_type: 'new', positions_count: 1, experience_min: 0, experience_max: 3, job_description: '', hiring_manager: '', l1_approver: '' });
      setGeneratedJd('');
      load();
    } catch (err) {
      alert(err.data?.detail || JSON.stringify(err.data) || 'Failed to create requisition');
    } finally {
      setCreateLoading(false);
    }
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
      const jd = `Job Title: ${createForm.title || 'Position'}\n\nJob Description:\nWe are looking for a talented ${createForm.title || 'candidate'} to join our team.\n\nKey Responsibilities:\n- Drive key initiatives and contribute to team goals\n- Collaborate with cross-functional teams\n- Deliver high quality results\n\nSkills Required:\n- Strong problem-solving ability\n- Excellent communication skills\n- Relevant domain expertise`;
      setGeneratedJd(jd);
      setCreateForm((f) => ({ ...f, job_description: jd }));
      setIsAiGenerating(false);
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
          <div className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between shrink-0">
            <h1 className="text-lg font-medium">Create Requisition</h1>
            <button onClick={() => setIsCreateOpen(false)}><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm p-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-8">New Requisition</h2>

              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">Requisition Title *</label>
                  <input type="text" value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500" placeholder="e.g. Senior Frontend Developer" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">Department *</label>
                  <div className="relative">
                    <select value={createForm.department} onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })} className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500 appearance-none bg-white">
                      <option value="">Select department…</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">Location *</label>
                  <input type="text" value={createForm.location} onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })} className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500" placeholder="e.g. Gurgaon, Haryana" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">Priority</label>
                  <div className="relative">
                    <select value={createForm.priority} onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })} className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500 appearance-none bg-white">
                      {['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">Experience Min (years)</label>
                  <input type="number" min="0" step="0.5" value={createForm.experience_min} onChange={(e) => setCreateForm({ ...createForm, experience_min: e.target.value })} className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">Experience Max (years)</label>
                  <input type="number" min="0" step="0.5" value={createForm.experience_max} onChange={(e) => setCreateForm({ ...createForm, experience_max: e.target.value })} className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">Positions Count</label>
                  <input type="number" min="1" value={createForm.positions_count} onChange={(e) => setCreateForm({ ...createForm, positions_count: e.target.value })} className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">Employment Type</label>
                  <div className="relative">
                    <select value={createForm.employment_type} onChange={(e) => setCreateForm({ ...createForm, employment_type: e.target.value })} className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500 appearance-none bg-white">
                      <option value="permanent">Permanent</option>
                      <option value="contract">Contract</option>
                      <option value="internship">Internship</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-2 col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Job Description</label>
                    <button onClick={handleGenerateJd} disabled={isAiGenerating} className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1 disabled:opacity-50">
                      <span className="text-lg leading-none">✨</span> {isAiGenerating ? 'Generating…' : 'Generate with AI'}
                    </button>
                  </div>
                  <textarea
                    value={createForm.job_description}
                    onChange={(e) => setCreateForm({ ...createForm, job_description: e.target.value })}
                    rows={6}
                    className="w-full border border-slate-300 rounded-md p-3 text-sm outline-none focus:border-blue-500 resize-y"
                    placeholder="Enter job description or click Generate…"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 mt-8 pt-6 border-t border-slate-100">
                <button onClick={handleCreate} disabled={createLoading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-8 py-2.5 rounded-md text-sm font-medium transition-colors">
                  {createLoading ? 'Creating…' : 'Create Requisition'}
                </button>
                <button onClick={() => setIsCreateOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-8 py-2.5 rounded-md text-sm font-medium transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
