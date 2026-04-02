import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, Download, Edit, MapPin, Phone, Mail, Filter, MessageSquarePlus, X, ChevronDown, Briefcase } from 'lucide-react';
import { candidates as candidatesApi, jobs as jobsApi } from '../lib/api';

function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {!title && (
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 z-10 bg-white/80">
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

const SOURCE_LABELS = {
  recruiter_upload: 'RECRUITER UPLOAD',
  naukri: 'NAUKRI',
  linkedin: 'LINKEDIN',
  referral: 'REFERRAL',
  manual: 'MANUAL',
};

const STAGE_LABELS = {
  pending: 'Pending',
  shortlisted: 'Shortlisted',
  interview: 'Evaluation Round 1 - Tech Interview Scheduled',
  on_hold: 'On Hold',
  selected: 'Selected',
  rejected: 'Rejected',
  offered: 'Offered',
  joined: 'Joined',
};

export default function Candidates({ user }) {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeModal, setActiveModal] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [allJobs, setAllJobs] = useState([]);
  const [moveJobId, setMoveJobId] = useState('');

  const loadCandidates = useCallback((q = '') => {
    setLoading(true);
    const params = {};
    if (q) params.search = q;
    candidatesApi.list(params)
      .then((res) => {
        setData(res.results || res);
        setTotal(res.count || (res.results || res).length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  useEffect(() => {
    jobsApi.list({ status: 'open' })
      .then((res) => setAllJobs(res.results || res))
      .catch(console.error);
  }, []);

  const openModal = (type, candidate) => {
    setSelectedCandidate(candidate);
    setActiveModal(type);
    setNoteText('');
    setMoveJobId('');
  };
  const closeModal = () => { setActiveModal(null); setSelectedCandidate(null); };

  const handleSearch = (e) => {
    e.preventDefault();
    loadCandidates(search);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !selectedCandidate) return;
    setNoteLoading(true);
    try {
      await candidatesApi.addNote(selectedCandidate.id, noteText);
      closeModal();
    } catch (err) {
      alert('Failed to save note');
    } finally {
      setNoteLoading(false);
    }
  };

  const handleMove = async () => {
    if (!moveJobId || !selectedCandidate) return;
    const currentJobId = selectedCandidate.current_job?.id;
    if (!currentJobId) {
      try {
        await candidatesApi.assignJob(selectedCandidate.id, moveJobId);
        closeModal();
        loadCandidates(search);
      } catch (err) {
        alert(err.data?.error || 'Failed to assign job');
      }
      return;
    }
    try {
      await candidatesApi.moveJob(selectedCandidate.id, currentJobId, moveJobId);
      closeModal();
      loadCandidates(search);
    } catch (err) {
      alert(err.data?.error || 'Failed to move candidate');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-medium">Talent Pool Search</h1>
        <div className="flex items-center gap-4 text-sm">
          <span>Welcome, {user?.full_name || 'User'}</span>
        </div>
      </div>

      <div className="flex gap-6 h-full p-6 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-white">
            <form onSubmit={handleSearch} className="flex items-center gap-4 flex-1">
              <div className="flex items-center border border-slate-300 rounded-md overflow-hidden bg-white w-96 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email, skills…"
                    className="w-full px-3 py-2 text-sm outline-none"
                  />
                  <button type="submit">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
              <span className="text-xs text-slate-500">{total} Profiles found</span>
            </form>
          </div>

          <div className="overflow-auto flex-1 bg-white">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading candidates…</div>
            ) : (
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-slate-300 cursor-pointer" />
                        Applicant <Filter className="w-3 h-3 text-slate-400" />
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
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <input type="checkbox" className="mt-1 rounded border-slate-300 cursor-pointer" />
                          <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-slate-800 text-sm hover:text-blue-600 cursor-pointer">
                              {c.full_name?.toUpperCase()}
                            </span>
                            <div className="flex flex-col gap-1 text-slate-500 text-xs">
                              <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-400" /> {c.phone || '—'}</span>
                              <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-400" /> {c.email}</span>
                              <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-slate-400" /> {c.location || '—'}</span>
                              <span className="flex items-center gap-1.5"><Briefcase className="w-3 h-3 text-slate-400" /> {c.total_experience_years ? `${c.total_experience_years} Yrs` : '—'}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-slate-400">
                              <button onClick={() => openModal('note', c)} className="hover:text-blue-600 transition-colors" title="Add Note"><MessageSquarePlus className="w-4 h-4" /></button>
                              <button onClick={() => openModal('edit', c)} className="hover:text-blue-600 transition-colors" title="Edit Profile"><Edit className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        {c.current_job ? (
                          <div className="flex flex-col text-sm">
                            <span className="text-slate-700">{c.current_job.title}</span>
                            <span className="text-slate-500 text-xs mt-1">({c.current_job.job_code})</span>
                          </div>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="text-slate-700 text-sm">
                          {c.current_stage ? STAGE_LABELS[c.current_stage] || c.current_stage : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="text-slate-700 font-medium text-sm">
                          {SOURCE_LABELS[c.source] || c.source}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-slate-600 text-sm">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB') : '—'}
                      </td>
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

        {/* Right filters sidebar */}
        <div className="w-72 shrink-0 flex flex-col gap-4 overflow-y-auto pb-4 pr-1">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-slate-800">By Experience (in Years)</h4>
            <div className="flex items-center gap-2">
              <input type="text" placeholder="Min" className="w-full border border-slate-300 rounded p-1.5 text-sm outline-none focus:border-blue-500 text-center" />
              <span className="text-slate-400 text-sm">to</span>
              <input type="text" placeholder="Max" className="w-full border border-slate-300 rounded p-1.5 text-sm outline-none focus:border-blue-500 text-center" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-slate-800">By Source</h4>
            <div className="flex flex-col gap-2">
              {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 rounded border-slate-300 cursor-pointer" />
                  <span className="flex-1 leading-tight">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Move Modal */}
      <Modal isOpen={activeModal === 'move'} onClose={closeModal} title="Move applicant to a job" maxWidth="max-w-2xl">
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
          <div className="flex items-center gap-3 mt-4">
            <button onClick={handleMove} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors">Move</button>
            <button onClick={closeModal} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-md text-sm font-medium transition-colors">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Add Note Modal */}
      <Modal isOpen={activeModal === 'note'} onClose={closeModal} title="Add Note" maxWidth="max-w-xl">
        <div className="flex flex-col gap-4">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Enter note…"
            className="w-full border border-slate-300 rounded-md p-3 text-sm outline-none focus:border-blue-500 min-h-[120px] resize-y"
          />
          <div className="flex items-center gap-3 mt-2">
            <button onClick={handleSaveNote} disabled={noteLoading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors">
              {noteLoading ? 'Saving…' : 'Save'}
            </button>
            <button onClick={closeModal} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-md text-sm font-medium transition-colors">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal isOpen={activeModal === 'edit'} onClose={closeModal} title="Edit Profile" maxWidth="max-w-2xl">
        {selectedCandidate && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">Full Name *</label>
                <input type="text" defaultValue={selectedCandidate.full_name} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">Email</label>
                <input type="email" defaultValue={selectedCandidate.email} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">Phone Number</label>
                <input type="text" defaultValue={selectedCandidate.phone} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">Current Location</label>
                <input type="text" defaultValue={selectedCandidate.location} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">Total Experience (years)</label>
                <input type="number" step="0.1" defaultValue={selectedCandidate.total_experience_years} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">Designation</label>
                <input type="text" defaultValue={selectedCandidate.designation} className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
              <button onClick={closeModal} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors">Save Changes</button>
              <button onClick={closeModal} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-md text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
