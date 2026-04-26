import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GitMerge, User, Briefcase, CheckCircle, XCircle, Clock, ChevronRight, FileText } from 'lucide-react';
import { referrals as referralsApi } from '../lib/api';
import { ROUTES } from '../routes/constants';

const STATUS_TABS = [
  { key: 'pending',  label: 'Pending',  icon: Clock },
  { key: 'approved', label: 'Approved', icon: CheckCircle },
  { key: 'declined', label: 'Declined', icon: XCircle },
];

const TAB_COLORS = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-rose-100 text-rose-700',
};

export default function Referrals() {
  const [activeTab, setActiveTab] = useState('pending');
  const [actionLoading, setActionLoading] = useState({});
  const [actionError, setActionError]     = useState({});
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['referrals', activeTab],
    queryFn: () => referralsApi.list(activeTab),
  });

  const handleAction = useCallback(async (id, action) => {
    setActionLoading(prev => ({ ...prev, [id]: action }));
    setActionError(prev => ({ ...prev, [id]: null }));
    try {
      if (action === 'approve') {
        await referralsApi.approve(id);
      } else {
        await referralsApi.decline(id);
      }
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
    } catch (err) {
      setActionError(prev => ({
        ...prev,
        [id]: err.data?.detail || 'Action failed. Please try again.',
      }));
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  }, [queryClient]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <GitMerge className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-slate-800">Referrals</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Review and approve or decline employee-submitted referrals.
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 shrink-0">
        <div className="flex gap-6">
          {STATUS_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="text-center py-16 text-slate-400 text-sm">Loading referrals…</div>
        )}
        {error && (
          <div className="text-center py-16 text-rose-500 text-sm">Failed to load referrals.</div>
        )}
        {!isLoading && !error && items.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            No {activeTab} referrals.
          </div>
        )}
        {!isLoading && !error && items.length > 0 && (
          <div className="flex flex-col gap-4 max-w-4xl">
            {items.map((r) => (
              <ReferralCard
                key={r.id}
                referral={r}
                isPending={activeTab === 'pending'}
                loading={actionLoading[r.id]}
                error={actionError[r.id]}
                onApprove={() => handleAction(r.id, 'approve')}
                onDecline={() => handleAction(r.id, 'decline')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReferralCard({ referral, isPending, loading, error, onApprove, onDecline }) {
  const r = referral;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        {/* Left: candidate + employee info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              r.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
              r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                        'bg-rose-100 text-rose-700'
            }`}>
              {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
            </span>
            {r.reviewed_by && (
              <span className="text-xs text-slate-400">
                by {r.reviewed_by}
                {r.reviewed_at && ` · ${new Date(r.reviewed_at).toLocaleDateString()}`}
              </span>
            )}
          </div>

          {/* Candidate details */}
          <div className="mb-4">
            <h3 className="font-semibold text-slate-800 text-base mb-0.5">{r.candidate_name}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-500">
              {r.candidate_email && <span>{r.candidate_email}</span>}
              {r.candidate_phone && <span>{r.candidate_phone}</span>}
              {r.candidate_designation && <span>{r.candidate_designation}</span>}
              {r.candidate_experience != null && (
                <span>{r.candidate_experience} yrs exp</span>
              )}
            </div>
            {r.candidate_skills?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {r.candidate_skills.slice(0, 8).map((s, i) => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
                {r.candidate_skills.length > 8 && (
                  <span className="text-xs text-slate-400">+{r.candidate_skills.length - 8}</span>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex items-center gap-1.5 text-slate-600">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>
                <span className="font-medium">{r.employee_name}</span>
                <span className="text-slate-400"> · ID: {r.employee_id}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              <span>{r.job_title}</span>
              {r.job_code && (
                <span className="text-xs text-slate-400">({r.job_code})</span>
              )}
            </div>
            <div className="text-slate-400 text-xs self-center">
              {new Date(r.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex flex-col gap-2 shrink-0">
          {/* View Resume — always shown if URL exists */}
          {r.resume_url && (
            <a
              href={r.resume_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <FileText className="w-4 h-4" />
              View Resume
            </a>
          )}

          {/* Approve / Decline — pending only */}
          {isPending && (
            <>
              <button
                onClick={onApprove}
                disabled={!!loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {loading === 'approve' ? 'Approving…' : 'Approve'}
              </button>
              <button
                onClick={onDecline}
                disabled={!!loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-rose-300 text-rose-600 text-sm font-medium hover:bg-rose-50 disabled:opacity-50 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                {loading === 'decline' ? 'Declining…' : 'Decline'}
              </button>
            </>
          )}

          {/* Approved: link to candidate profile */}
          {!isPending && r.status === 'approved' && r.candidate_id && (
            <Link
              to={ROUTES.CANDIDATES.PROFILE(r.candidate_id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              <User className="w-4 h-4" />
              View Candidate
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-rose-600">{error}</p>
      )}
    </div>
  );
}
