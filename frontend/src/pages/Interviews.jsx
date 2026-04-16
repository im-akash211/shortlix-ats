import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Phone, Mail, Briefcase, Search, X, Star, ChevronDown, ChevronRight } from 'lucide-react';
import { PageLoader } from '../components/LoadingDots';
import { interviews as interviewsApi } from '../lib/api';
import { useAuth } from '../lib/authContext';

const MODE_LABELS = {
  virtual: 'Virtual',
  phone: 'Phone Call',
  face_to_face: 'Face-to-Face',
};

const RECOMMENDATION_LABELS = {
  proceed: 'Proceed',
  hold: 'Hold',
  reject: 'Reject',
};

function formatSchedule(scheduledAt, durationMin) {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + (durationMin || 60) * 60000);
  const date = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const startT = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const endT = end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} ${startT} – ${endT}`;
}

function isPendingFeedback(iv) {
  return iv.status === 'scheduled' && new Date(iv.scheduled_at) < new Date();
}

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`transition-colors ${n <= value ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}
        >
          <Star className="w-6 h-6 fill-current" />
        </button>
      ))}
    </div>
  );
}

export default function Interviews() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = user?.role;
  const [searchParams, setSearchParams] = useSearchParams();

  // Phase D: activeTab is URL-backed — survives refresh and browser navigation
  const defaultTab = role === 'recruiter' ? 'scheduled_by_me' : role === 'hiring_manager' ? 'hm_interviews' : 'my';
  const activeTab = searchParams.get('tab') || defaultTab;
  const setActiveTab = (val) => {
    setSearchParams(p => { p.set('tab', val); return p; });
    setActiveFilter(null);
  };

  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(null);

  // Cancel modal
  const [isCancelConfirm, setIsCancelConfirm] = useState(false);

  // Feedback modal
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ recommendation: '', overall_rating: 0, comments: '' });

  // Candidate detail panel
  const [detailPanel, setDetailPanel] = useState(null);
  const [feedbackDetail, setFeedbackDetail] = useState(null);
  const [accordionOpen, setAccordionOpen] = useState(true);

  // Phase B+C: list is cached per tab; previous tab data stays visible while switching
  const { data: listData, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['interviews', 'list', activeTab],
    queryFn: () => interviewsApi.list({ tab: activeTab }),
    placeholderData: (previousData) => previousData,
  });
  const listLoading = isLoading || isPlaceholderData;

  const data = listData ? (listData.results || listData) : [];

  const now = new Date();

  // Compute summary counts from the current tab's data so they stay in sync
  const summary = {
    pending_confirmation: 0,
    upcoming: data.filter((iv) => iv.status === 'scheduled' && new Date(iv.scheduled_at) >= now).length,
    pending_feedback: data.filter((iv) => isPendingFeedback(iv)).length,
    completed: data.filter((iv) => iv.status === 'completed').length,
  };

  const handleCancel = async (id) => {
    try {
      await interviewsApi.cancel(id);
      setIsCancelConfirm(false);
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
    } catch (err) {
      alert(err.data?.error || 'Failed to cancel interview');
    }
  };

  const openFeedback = (iv) => {
    setSelected(iv);
    setFeedbackForm({ recommendation: '', overall_rating: 0, comments: '' });
    setIsFeedbackOpen(true);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackForm.recommendation || !feedbackForm.overall_rating) {
      alert('Please select a recommendation and rating.');
      return;
    }
    setFeedbackLoading(true);
    try {
      await interviewsApi.submitFeedback(selected.id, feedbackForm);
      setIsFeedbackOpen(false);
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
    } catch (err) {
      alert(err.data?.error || 'Failed to submit feedback');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const openDetailPanel = async (iv) => {
    setDetailPanel(iv);
    setFeedbackDetail(null);
    setAccordionOpen(true);
    if (iv.has_feedback) {
      try {
        const fb = await interviewsApi.getFeedback(iv.id);
        setFeedbackDetail(fb);
      } catch (_) {}
    }
  };

  let filteredData = search.trim()
    ? data.filter((iv) =>
        iv.candidate_name?.toLowerCase().includes(search.toLowerCase()) ||
        iv.job_title?.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  if (activeFilter === 'upcoming') {
    filteredData = filteredData.filter((iv) => iv.status === 'scheduled' && new Date(iv.scheduled_at) >= now);
  } else if (activeFilter === 'pending_feedback') {
    filteredData = filteredData.filter((iv) => isPendingFeedback(iv));
  } else if (activeFilter === 'completed') {
    filteredData = filteredData.filter((iv) => iv.status === 'completed');
  } else if (activeFilter === 'pending_confirmation') {
    filteredData = [];
  }

  const summaryCards = [
    { key: 'pending_confirmation', label: 'Pending Confirmation', value: summary.pending_confirmation ?? 0, activeBg: 'bg-amber-500 border-amber-500',  activeText: 'text-white', activeSub: 'text-amber-100' },
    { key: 'upcoming',             label: 'Upcoming Interviews',  value: summary.upcoming ?? 0,             activeBg: 'bg-blue-600 border-blue-600',   activeText: 'text-white', activeSub: 'text-blue-100' },
    { key: 'pending_feedback',     label: 'Pending Feedback',     value: summary.pending_feedback ?? 0,     activeBg: 'bg-rose-500 border-rose-500',   activeText: 'text-white', activeSub: 'text-rose-100' },
    { key: 'completed',            label: 'Interviews Completed', value: summary.completed ?? 0,            activeBg: 'bg-emerald-600 border-emerald-600', activeText: 'text-white', activeSub: 'text-emerald-100' },
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const isActive = activeFilter === card.key;
          return (
            <button
              key={card.key}
              onClick={() => setActiveFilter(isActive ? null : card.key)}
              className={`border rounded-xl p-5 shadow-sm flex items-center gap-4 transition-colors text-left w-full cursor-pointer hover:shadow-md ${
                isActive ? card.activeBg : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={`text-4xl font-bold ${isActive ? card.activeText : 'text-slate-800'}`}>{card.value}</span>
              <span className={`font-medium text-sm leading-tight ${isActive ? card.activeSub : 'text-slate-500'}`}>{card.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main List */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden min-h-0">
        <div className="p-4 border-b border-slate-200 flex items-center gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1">
            {[
              { key: 'my',              label: 'My Interviews',   roles: ['admin', 'interviewer'] },
              { key: 'scheduled_by_me', label: 'Scheduled by Me', roles: ['admin', 'recruiter'] },
              { key: 'hm_interviews',   label: 'Interviews',      roles: ['hiring_manager'] },
              { key: 'all',             label: 'All Schedules',   roles: ['admin', 'hiring_manager', 'recruiter', 'interviewer'] },
            ].filter((t) => t.roles.includes(role)).map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="ml-auto flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-72">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by candidate or job…"
              className="bg-transparent outline-none text-sm w-full"
            />
          </div>
        </div>

        <div className="overflow-auto flex-1">
          {listLoading ? (
            <PageLoader label="Loading interviews…" />
          ) : filteredData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No interviews found.</div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200">Applicant</th>
                  <th className="px-4 py-3 border-b border-slate-200">Job Title</th>
                  <th className="px-4 py-3 border-b border-slate-200">Interviewers</th>
                  <th className="px-4 py-3 border-b border-slate-200">Stage</th>
                  <th className="px-4 py-3 border-b border-slate-200">Scheduled Date</th>
                  <th className="px-4 py-3 border-b border-slate-200 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((iv) => (
                  <tr key={iv.id} className="hover:bg-blue-50/30 transition-colors">
                    {/* Applicant */}
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => openDetailPanel(iv)}
                          className="font-semibold text-slate-800 hover:text-blue-600 hover:underline text-left"
                        >
                          {iv.candidate_name?.toUpperCase()}
                        </button>
                        <div className="flex flex-col gap-0.5 text-slate-500 text-xs">
                          {iv.candidate_phone    && <span className="flex items-center gap-1"><Phone   className="w-3 h-3" /> {iv.candidate_phone}</span>}
                          {iv.candidate_email    && <span className="flex items-center gap-1"><Mail    className="w-3 h-3" /> {iv.candidate_email}</span>}
                          {iv.candidate_location && <span className="flex items-center gap-1"><MapPin  className="w-3 h-3" /> {iv.candidate_location}</span>}
                          {iv.candidate_experience != null && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {iv.candidate_experience} Yrs</span>}
                        </div>
                      </div>
                    </td>

                    {/* Job Title */}
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col">
                        <span className="text-slate-700 font-medium">{iv.job_title}</span>
                        <span className="text-slate-500 text-xs">{iv.job_code}</span>
                      </div>
                    </td>

                    {/* Interviewers */}
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-1 text-slate-600">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                          {iv.interviewer_name?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs">{iv.interviewer_name}</span>
                      </div>
                    </td>

                    {/* Stage (round label) */}
                    <td className="px-4 py-4 align-top text-slate-600 text-xs">{iv.round_label}</td>

                    {/* Scheduled Date */}
                    <td className="px-4 py-4 align-top text-slate-600 text-xs whitespace-nowrap">
                      {formatSchedule(iv.scheduled_at, iv.duration_minutes)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 align-top text-center">
                      <div className="flex items-center justify-center gap-2">
                        {(isPendingFeedback(iv) || (iv.status === 'completed' && !iv.has_feedback)) && iv.interviewer === user?.id && (
                          <button
                            onClick={() => openFeedback(iv)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            Provide Feedback
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        )}
                        {iv.status === 'completed' && iv.has_feedback && (
                          <button
                            onClick={() => openDetailPanel(iv)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                          >
                            View Details
                          </button>
                        )}
                        {iv.status === 'scheduled' && !isPendingFeedback(iv) && (
                          <button
                            onClick={() => { setSelected(iv); setIsCancelConfirm(true); }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                          >
                            Cancel
                          </button>
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
              <button onClick={() => handleCancel(selected.id)} className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded text-sm font-medium">Yes, Cancel</button>
              <button onClick={() => setIsCancelConfirm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded text-sm font-medium">No, Keep It</button>
            </div>
          </div>
        </div>
      )}

      {/* Provide Feedback Modal */}
      {isFeedbackOpen && selected && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[520px] max-w-[90vw] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-slate-800">Provide Feedback</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selected.candidate_name} · {selected.round_label} · {selected.job_title}</p>
              </div>
              <button onClick={() => setIsFeedbackOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="flex flex-col gap-5">
              {/* Recommendation */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Interview Result *</label>
                <div className="flex gap-3">
                  {[
                    { value: 'proceed', label: 'Proceed', color: 'emerald' },
                    { value: 'hold',    label: 'Hold',    color: 'amber'   },
                    { value: 'reject',  label: 'Reject',  color: 'rose'    },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFeedbackForm((f) => ({ ...f, recommendation: opt.value }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                        feedbackForm.recommendation === opt.value
                          ? opt.value === 'proceed'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : opt.value === 'hold'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-rose-500 bg-rose-50 text-rose-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Overall Rating *</label>
                <StarRating
                  value={feedbackForm.overall_rating}
                  onChange={(n) => setFeedbackForm((f) => ({ ...f, overall_rating: n }))}
                />
              </div>

              {/* Comments */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Comments</label>
                <textarea
                  value={feedbackForm.comments}
                  onChange={(e) => setFeedbackForm((f) => ({ ...f, comments: e.target.value }))}
                  placeholder="Add any additional notes…"
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmitFeedback}
                disabled={feedbackLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded text-sm font-medium transition-colors"
              >
                {feedbackLoading ? 'Submitting…' : 'Submit Feedback'}
              </button>
              <button onClick={() => setIsFeedbackOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded text-sm font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Detail Panel */}
      {detailPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-slate-900/40" onClick={() => setDetailPanel(null)} />
          <div className="w-[420px] bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{detailPanel.candidate_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{detailPanel.job_title} · {detailPanel.job_code}</p>
              </div>
              <button onClick={() => setDetailPanel(null)} className="mt-0.5 p-1 hover:bg-slate-200 rounded-full text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Candidate Info */}
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex flex-col gap-1.5 text-sm text-slate-600">
                {detailPanel.candidate_phone    && <span className="flex items-center gap-2"><Phone   className="w-4 h-4 text-slate-400" /> {detailPanel.candidate_phone}</span>}
                {detailPanel.candidate_email    && <span className="flex items-center gap-2"><Mail    className="w-4 h-4 text-slate-400" /> {detailPanel.candidate_email}</span>}
                {detailPanel.candidate_location && <span className="flex items-center gap-2"><MapPin  className="w-4 h-4 text-slate-400" /> {detailPanel.candidate_location}</span>}
                {detailPanel.candidate_experience != null && <span className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-slate-400" /> {detailPanel.candidate_experience} Years Experience</span>}
              </div>
            </div>

            {/* Assessment & Interviews Accordion */}
            <div className="flex-1 overflow-auto">
              <button
                onClick={() => setAccordionOpen((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3 bg-blue-50 border-b border-blue-100 text-sm font-semibold text-blue-800"
              >
                Assessment & Interviews
                {accordionOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {accordionOpen && (
                <div className="px-5 py-4 flex flex-col gap-4 text-sm">
                  {/* Interview Details */}
                  <div className="bg-slate-50 rounded-lg p-3 flex flex-col gap-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Interview Scheduled</p>
                    <p className="text-slate-700 font-medium">{detailPanel.round_label}</p>
                    <p className="text-slate-500 text-xs">{formatSchedule(detailPanel.scheduled_at, detailPanel.duration_minutes)}</p>
                    <p className="text-slate-500 text-xs">{MODE_LABELS[detailPanel.mode] || detailPanel.mode}</p>
                  </div>

                  {/* Feedback section */}
                  {detailPanel.has_feedback && feedbackDetail ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Feedback Submitted</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          feedbackDetail.recommendation === 'proceed' ? 'bg-emerald-100 text-emerald-700' :
                          feedbackDetail.recommendation === 'hold'    ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {RECOMMENDATION_LABELS[feedbackDetail.recommendation]}
                        </span>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map((n) => (
                            <Star key={n} className={`w-3.5 h-3.5 fill-current ${n <= feedbackDetail.overall_rating ? 'text-amber-400' : 'text-slate-200'}`} />
                          ))}
                        </div>
                      </div>
                      {feedbackDetail.comments && <p className="text-slate-600 text-xs">{feedbackDetail.comments}</p>}
                    </div>
                  ) : (isPendingFeedback(detailPanel) || (detailPanel.status === 'completed' && !detailPanel.has_feedback)) && detailPanel.interviewer === user?.id ? (
                    <button
                      onClick={() => { setDetailPanel(null); openFeedback(detailPanel); }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors self-start"
                    >
                      Provide Feedback
                    </button>
                  ) : (
                    <p className="text-slate-400 text-xs">No feedback yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
