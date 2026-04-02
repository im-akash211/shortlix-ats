import React, { useState, useEffect } from 'react';
import { Download, Filter, MapPin, Phone, Mail, Briefcase, Search, ChevronDown, X } from 'lucide-react';
import { interviews as interviewsApi } from '../lib/api';

const STATUS_BADGE = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
  no_show: 'bg-rose-100 text-rose-700',
};

const MODE_LABELS = {
  virtual: 'Virtual',
  phone: 'Phone Call',
  face_to_face: 'Face-to-Face',
};

export default function Interviews({ user }) {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ upcoming: 0, pending_feedback: 0, completed: 0 });
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [isCancelConfirm, setIsCancelConfirm] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      interviewsApi.list({ tab: activeTab }),
      interviewsApi.summary(),
    ])
      .then(([listRes, sumRes]) => {
        setData(listRes.results || listRes);
        setSummary(sumRes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [activeTab]);

  const handleCancel = async (id) => {
    try {
      await interviewsApi.cancel(id);
      setIsCancelConfirm(false);
      setSelected(null);
      load();
    } catch (err) {
      alert(err.data?.error || 'Failed to cancel interview');
    }
  };

  const summaryCards = [
    { label: 'Upcoming', value: summary.upcoming, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
    { label: 'Pending Feedback', value: summary.pending_feedback, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    { label: 'Completed', value: summary.completed, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6">
        {summaryCards.map((card) => (
          <div key={card.label} className={`bg-white border rounded-xl p-5 shadow-sm flex items-center justify-between ${card.bg}`}>
            <div className="flex flex-col gap-1">
              <span className={`text-4xl font-bold ${card.color}`}>{card.value}</span>
              <span className="text-slate-600 font-medium text-sm">{card.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main List */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden min-h-0">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-80">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search by candidate or job…" className="bg-transparent outline-none text-sm w-full" />
          </div>

          <div className="flex items-center gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'my', label: 'My Interviews' },
              { key: 'scheduled_by_me', label: 'Scheduled by Me' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button className="ml-auto flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600">
            <Filter className="w-4 h-4 text-slate-400" />
            Filter
          </button>
        </div>

        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading interviews…</div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No interviews found.</div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200">Applicant</th>
                  <th className="px-4 py-3 border-b border-slate-200">Job</th>
                  <th className="px-4 py-3 border-b border-slate-200">Interviewer</th>
                  <th className="px-4 py-3 border-b border-slate-200">Round</th>
                  <th className="px-4 py-3 border-b border-slate-200">Scheduled At</th>
                  <th className="px-4 py-3 border-b border-slate-200">Mode</th>
                  <th className="px-4 py-3 border-b border-slate-200">Status</th>
                  <th className="px-4 py-3 border-b border-slate-200 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((iv) => (
                  <tr key={iv.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-800">{iv.candidate_name?.toUpperCase()}</span>
                        <div className="flex flex-col gap-0.5 text-slate-500 text-xs">
                          {iv.candidate_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {iv.candidate_phone}</span>}
                          {iv.candidate_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {iv.candidate_email}</span>}
                          {iv.candidate_location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {iv.candidate_location}</span>}
                          {iv.candidate_experience && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {iv.candidate_experience} Yrs</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col">
                        <span className="text-slate-700 font-medium">{iv.job_title}</span>
                        <span className="text-slate-500 text-xs">{iv.job_code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">{iv.interviewer_name}</td>
                    <td className="px-4 py-4 align-top text-slate-600">{iv.round_label}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col text-slate-600">
                        <span>{new Date(iv.scheduled_at).toLocaleDateString('en-GB')}</span>
                        <span className="text-xs text-slate-500">{new Date(iv.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">{MODE_LABELS[iv.mode] || iv.mode}</td>
                    <td className="px-4 py-4 align-top">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${STATUS_BADGE[iv.status] || 'bg-slate-100 text-slate-600'}`}>
                        {iv.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-center">
                      <div className="flex items-center justify-center gap-2">
                        {iv.status === 'scheduled' && (
                          <button
                            onClick={() => { setSelected(iv); setIsCancelConfirm(true); }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1 rounded text-xs font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                        {iv.status === 'completed' && !iv.has_feedback && (
                          <span className="text-xs text-amber-600 font-medium">Feedback pending</span>
                        )}
                        {iv.status === 'completed' && iv.has_feedback && (
                          <span className="text-xs text-emerald-600 font-medium">Feedback submitted</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {isCancelConfirm && selected && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[450px] max-w-[90vw] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Cancel Interview</h3>
              <button onClick={() => setIsCancelConfirm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to cancel the interview for <strong>{selected.candidate_name}</strong> — {selected.round_label}?
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleCancel(selected.id)} className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded text-sm font-medium transition-colors">Yes, Cancel</button>
              <button onClick={() => setIsCancelConfirm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded text-sm font-medium transition-colors">No, Keep It</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
