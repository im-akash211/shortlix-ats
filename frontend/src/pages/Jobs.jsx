import React, { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Clock, Eye, Mail, UserPlus, Users, ChevronDown, ChevronUp, Network, User, X, Filter, Phone } from 'lucide-react';
import { jobs as jobsApi, candidates as candidatesApi, interviews as interviewsApi, users as usersApi } from '../lib/api';

function FilterAccordion({ title, options, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 text-sm">{title}</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {options.map((opt, j) => (
            <label key={j} className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" className="mt-0.5 rounded border-slate-300 cursor-pointer" />
              <span className="flex-1 leading-tight">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const STAGE_TAB_MAP = {
  Applies: null,
  Shortlists: 'shortlisted',
  Offers: 'offered',
  Joined: 'joined',
};

export default function Jobs({ user }) {
  const [activeTab, setActiveTab] = useState('My Jobs');
  const [jobsList, setJobsList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');

  const [viewingJob, setViewingJob] = useState(null);
  const [pipelineTab, setPipelineTab] = useState('Applies');
  const [pipeline, setPipeline] = useState([]);
  const [pipelineStats, setPipelineStats] = useState({});
  const [pipelineLoading, setPipelineLoading] = useState(false);

  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isAddProfileOpen, setIsAddProfileOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: '', email: '', phone: '', location: '', total_experience_years: '' });
  const [addLoading, setAddLoading] = useState(false);

  const [scheduleCandidate, setScheduleCandidate] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    round_number: 1, round_label: '', interviewer: '',
    scheduled_at: '', duration_minutes: 60, mode: 'virtual', meeting_link: '',
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [scheduleToast, setScheduleToast] = useState(null);

  const loadJobs = useCallback(() => {
    setLoading(true);
    const params = { status: statusFilter === 'all' ? '' : statusFilter };
    if (activeTab === 'My Jobs') params.tab = 'mine';
    if (search) params.search = search;
    jobsApi.list(params)
      .then((res) => {
        const list = res.results || res;
        setJobsList(list);
        setTotal(res.count || list.length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab, statusFilter, search]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const openJobDetails = (job, tab = 'Applies') => {
    setViewingJob(job);
    setPipelineTab(tab);
  };

  useEffect(() => {
    if (!viewingJob) return;
    setPipelineLoading(true);
    const stage = STAGE_TAB_MAP[pipelineTab];
    const params = stage ? { stage } : {};
    Promise.all([
      jobsApi.pipeline(viewingJob.id, params),
      jobsApi.pipelineStats(viewingJob.id),
    ])
      .then(([pipeRes, statsRes]) => {
        setPipeline(pipeRes.results || pipeRes);
        setPipelineStats(statsRes);
      })
      .catch(console.error)
      .finally(() => setPipelineLoading(false));
  }, [viewingJob, pipelineTab]);

  const handleAddProfile = async () => {
    if (!addForm.full_name || !addForm.email) return;
    setAddLoading(true);
    try {
      const candidate = await candidatesApi.create({
        ...addForm,
        total_experience_years: addForm.total_experience_years || null,
        source: 'manual',
      });
      if (viewingJob) {
        await candidatesApi.assignJob(candidate.id, viewingJob.id);
      }
      setIsAddProfileOpen(false);
      setAddForm({ full_name: '', email: '', phone: '', location: '', total_experience_years: '' });
      if (viewingJob) {
        setPipelineTab('Applies');
      }
    } catch (err) {
      alert(err.data?.email?.[0] || err.data?.detail || 'Failed to add profile');
    } finally {
      setAddLoading(false);
    }
  };

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
        mapping: scheduleCandidate.id,
        round_number: Number(scheduleForm.round_number),
        round_label: scheduleForm.round_label,
        interviewer: scheduleForm.interviewer,
        scheduled_at: scheduleForm.scheduled_at,
        duration_minutes: Number(scheduleForm.duration_minutes),
        mode: scheduleForm.mode,
        meeting_link: scheduleForm.meeting_link,
      });
      setScheduleToast({ type: 'success', message: 'Interview scheduled successfully.' });
      setTimeout(() => closeScheduleModal(), 1200);
    } catch (err) {
      setScheduleToast({ type: 'error', message: err.data?.detail || JSON.stringify(err.data) || 'Failed to schedule interview.' });
    } finally {
      setScheduleLoading(false);
    }
  };

  const renderCandidateCard = (c) => (
    <div key={c.id} className="flex gap-6 border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
      <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold shrink-0">
        {c.candidate_name ? c.candidate_name.slice(0, 2).toUpperCase() : '?'}
      </div>
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{c.candidate_name?.toUpperCase()}</h3>
            <p className="text-sm text-slate-500">Stage: <span className="capitalize">{c.stage}</span></p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setScheduleCandidate(c);
                setIsScheduleOpen(true);
                usersApi.list().then((res) => setUsersList(res.results || res)).catch(console.error);
              }}
              className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-medium transition-colors"
            >
              Schedule Interview
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <span className="text-slate-500 flex items-center gap-1.5"><Mail className="w-4 h-4" /> Email</span>
            <span className="font-medium text-slate-800 truncate">{c.candidate_email}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-slate-500 flex items-center gap-1.5"><Phone className="w-4 h-4" /> Phone</span>
            <span className="font-medium text-slate-800">{c.candidate_phone || '—'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-slate-500 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Location</span>
            <span className="font-medium text-slate-800">{c.candidate_location || '—'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-slate-500 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Experience</span>
            <span className="font-medium text-slate-800">{c.candidate_experience ? `${c.candidate_experience} Yrs` : '—'}</span>
          </div>
        </div>
        {c.candidate_skills?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {c.candidate_skills.slice(0, 5).map((s, i) => (
              <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">{s}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const getStatCount = (tab) => {
    if (!pipelineStats) return 0;
    if (tab === 'Applies') return pipelineStats.total || 0;
    if (tab === 'Shortlists') return (pipelineStats.shortlisted || 0) + (pipelineStats.interview || 0) + (pipelineStats.selected || 0) + (pipelineStats.offered || 0) + (pipelineStats.joined || 0);
    if (tab === 'Offers') return (pipelineStats.offered || 0) + (pipelineStats.joined || 0);
    if (tab === 'Joined') return pipelineStats.joined || 0;
    return 0;
  };

  return (
    <>
      {viewingJob ? (
        <div className="flex flex-col h-full relative bg-slate-50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button onClick={() => setViewingJob(null)} className="text-slate-500 hover:text-slate-800 transition-colors">
                ← Back to Jobs
              </button>
              <h2 className="text-xl font-bold text-slate-800">
                {viewingJob.title} <span className="text-slate-500 text-base font-normal">({viewingJob.job_code})</span>
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAddProfileOpen(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                Add Profile
              </button>
            </div>
          </div>

          <div className="flex border-b border-slate-200 bg-white rounded-t-xl shadow-sm overflow-hidden">
            {['Applies', 'Shortlists', 'Offers', 'Joined'].map((tab) => (
              <button
                key={tab}
                onClick={() => setPipelineTab(tab)}
                className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors text-center ${
                  pipelineTab === tab
                    ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl font-bold">{getStatCount(tab)}</span>
                  <span className="text-xs uppercase tracking-wider">{tab}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200">
            {pipelineLoading ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading pipeline…</div>
            ) : pipeline.length > 0 ? (
              <div className="flex flex-col gap-6">{pipeline.map(renderCandidateCard)}</div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <Users className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-lg font-medium">No candidates in {pipelineTab} yet.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full relative">
          <div className="flex gap-6 mb-4 border-b border-slate-200">
            {['My Jobs', 'All Jobs'].map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`pb-3 border-b-2 font-semibold ${activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 mb-6 shadow-sm">
            <div className="flex items-center gap-3 flex-1">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadJobs()}
                placeholder="Search Keywords"
                className="outline-none w-full text-sm"
              />
            </div>
            <div className="text-sm font-medium text-slate-600 px-4 border-x border-slate-200 mx-4 italic">
              {total} Jobs Found
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              {['open', 'hidden', 'closed', 'all'].map((s) => (
                <label key={s} className="flex items-center gap-1.5 cursor-pointer capitalize">
                  <input type="radio" name="status" className="accent-blue-600" checked={statusFilter === s} onChange={() => setStatusFilter(s)} />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-6 flex-1 min-h-0">
            <div className="flex-1 flex flex-col overflow-y-auto pr-2 pb-4">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading jobs…</div>
              ) : (
                <div className="flex flex-col gap-4">
                  {jobsList.map((job) => (
                    <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-5 flex justify-between shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openJobDetails(job)} className="text-lg font-semibold text-slate-800 hover:text-blue-600 text-left transition-colors">
                            {job.job_code}, {job.title}
                          </button>
                          <div className="flex gap-1.5 text-slate-400">
                            <Network className="w-4 h-4" />
                            <User className="w-4 h-4" />
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {job.location}</span>
                          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {new Date(job.created_at).toLocaleDateString('en-GB')}</span>
                          {job.hiring_manager_name && (
                            <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {job.hiring_manager_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm font-medium text-blue-600 mt-1">
                          <button onClick={() => openJobDetails(job)} className="flex items-center gap-1.5 hover:text-blue-800"><Eye className="w-4 h-4" /> View</button>
                          <button onClick={() => setIsAddProfileOpen(true) || setViewingJob(job)} className="flex items-center gap-1.5 hover:text-blue-800"><UserPlus className="w-4 h-4" /> Add Profile</button>
                          <button onClick={() => { setSelectedJob(job); setIsCollabModalOpen(true); }} className="flex items-center gap-1.5 hover:text-blue-800"><Users className="w-4 h-4" /> Collaborators</button>
                        </div>
                      </div>
                      <div className="flex gap-1 items-center">
                        {[
                          { label: 'Applies', value: job.applies_count },
                          { label: 'Shortlists', value: job.shortlists_count },
                          { label: 'Offers', value: job.offers_count },
                          { label: 'Joined', value: job.joined_count },
                        ].map((stat, idx) => (
                          <button
                            key={idx}
                            onClick={() => openJobDetails(job, stat.label)}
                            className="flex flex-col items-center justify-center min-w-[70px] cursor-pointer hover:bg-slate-100 p-2 rounded-lg transition-colors"
                          >
                            <span className="text-2xl font-bold text-slate-700 hover:text-blue-600">{stat.value ?? 0}</span>
                            <span className="text-xs text-slate-500 font-medium">{stat.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {jobsList.length === 0 && !loading && (
                    <div className="flex items-center justify-center h-48 text-slate-400">No jobs found.</div>
                  )}
                </div>
              )}
            </div>

            <div className="w-72 shrink-0 flex flex-col overflow-y-auto pb-4 pr-1">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-slate-50 z-10 py-1">
                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                </div>
                <button className="text-blue-600 text-sm font-medium hover:underline">Clear All</button>
              </div>
              <FilterAccordion title="Department" options={['Backend Engineering', 'Full Stack', 'Analytics', 'Data Science']} defaultOpen />
              <FilterAccordion title="Status" options={['Open', 'Hidden', 'Closed']} defaultOpen={false} />
            </div>
          </div>
        </div>
      )}

      {/* Collaborators Modal */}
      {isCollabModalOpen && selectedJob && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-w-[90vw]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">
                Collaborators | {selectedJob.job_code}, {selectedJob.title}
              </h3>
              <button onClick={() => setIsCollabModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Add existing users to manage applications for this job.
              </p>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setIsCollabModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded text-sm font-medium transition-colors">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Profile Modal */}
      {isAddProfileOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-w-[90vw]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Add Profile Manually</h3>
              <button onClick={() => setIsAddProfileOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-sm font-medium text-slate-700">Full Name *</label>
                  <input type="text" value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} className="border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Email *</label>
                  <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} className="border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Phone</label>
                  <input type="tel" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} className="border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Location</label>
                  <input type="text" value={addForm.location} onChange={(e) => setAddForm({ ...addForm, location: e.target.value })} className="border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Experience (years)</label>
                  <input type="number" step="0.1" value={addForm.total_experience_years} onChange={(e) => setAddForm({ ...addForm, total_experience_years: e.target.value })} className="border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setIsAddProfileOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded text-sm font-medium transition-colors">Cancel</button>
                <button onClick={handleAddProfile} disabled={addLoading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                  {addLoading ? 'Saving…' : 'Save Profile'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Interview Modal */}
      {isScheduleOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-w-[90vw]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Schedule Interview</h3>
              <button onClick={closeScheduleModal} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {scheduleToast && (
                <div className={`text-sm px-4 py-3 rounded-md font-medium ${scheduleToast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                  {scheduleToast.message}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Candidate</label>
                <div className="border border-slate-200 rounded px-3 py-2 text-sm text-slate-500 bg-slate-50">
                  {scheduleCandidate?.candidate_name || '—'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Round Number</label>
                  <input
                    type="number" min="1"
                    value={scheduleForm.round_number}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, round_number: e.target.value })}
                    className="border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Round Label</label>
                  <input
                    type="text" placeholder="e.g. Technical Round"
                    value={scheduleForm.round_label}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, round_label: e.target.value })}
                    className="border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Interviewer *</label>
                  <select
                    value={scheduleForm.interviewer}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, interviewer: e.target.value })}
                    className="border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">Select interviewer…</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Scheduled At *</label>
                  <input
                    type="datetime-local"
                    value={scheduleForm.scheduled_at}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_at: e.target.value })}
                    className="border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Duration (minutes)</label>
                  <input
                    type="number" min="15" step="15"
                    value={scheduleForm.duration_minutes}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, duration_minutes: e.target.value })}
                    className="border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Mode</label>
                  <select
                    value={scheduleForm.mode}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, mode: e.target.value })}
                    className="border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="virtual">Virtual</option>
                    <option value="phone">Phone</option>
                    <option value="face_to_face">Face to Face</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Meeting Link <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text" placeholder="https://meet.google.com/..."
                  value={scheduleForm.meeting_link}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, meeting_link: e.target.value })}
                  className="border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={closeScheduleModal} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded text-sm font-medium transition-colors">
                Cancel
              </button>
              <button
                onClick={handleScheduleSubmit}
                disabled={scheduleLoading || !scheduleForm.interviewer || !scheduleForm.scheduled_at}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                {scheduleLoading ? 'Scheduling…' : 'Schedule Interview'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
