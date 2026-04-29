import React, { useState, useEffect, useRef } from 'react';
import { Search, User, CheckCircle, AlertCircle, Loader, X, ArrowRight, AlertTriangle, ShieldOff } from 'lucide-react';
import { candidates as candidatesApi } from '../../../lib/api';
import { useAuth } from '../../../lib/authContext';
import { hasPermission } from '../../../lib/permissions';

export default function ApplyCandidateModal({ job, onClose, onSuccess }) {
  const { user } = useAuth();
  const isAdmin = hasPermission(user, 'MANAGE_USERS');

  const [search, setSearch]       = useState('');
  const [results, setResults]     = useState([]);
  const [fetching, setFetching]   = useState(false);
  const [applying, setApplying]   = useState(null);
  const [applied, setApplied]     = useState({});
  const [conflicts, setConflicts] = useState({});
  const [errors, setErrors]       = useState({});
  // confirmMove: { candidate, fromJobId, fromJobCode } | null
  const [confirmMove, setConfirmMove] = useState(null);

  const debounceRef = useRef(null);
  const inputRef    = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const data = await candidatesApi.list({ search, page_size: 30 });
        setResults(data.results ?? data);
      } catch {
        setResults([]);
      } finally {
        setFetching(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const handleApply = async (candidate) => {
    setApplying(candidate.id);
    setErrors(prev => ({ ...prev, [candidate.id]: undefined }));
    setConflicts(prev => ({ ...prev, [candidate.id]: undefined }));
    try {
      await candidatesApi.assignJob(candidate.id, job.id);
      setApplied(prev => ({ ...prev, [candidate.id]: true }));
      onSuccess && onSuccess(candidate);
    } catch (err) {
      if (err.status === 409 && err.data?.conflict) {
        setConflicts(prev => ({ ...prev, [candidate.id]: err.data.current_job }));
      } else {
        const msg = err.data?.error || err.data?.detail || 'Failed to apply';
        setErrors(prev => ({ ...prev, [candidate.id]: msg }));
      }
    } finally {
      setApplying(null);
    }
  };

  const executeMove = async (candidate, fromJobId) => {
    setConfirmMove(null);
    setApplying(candidate.id);
    setConflicts(prev => ({ ...prev, [candidate.id]: undefined }));
    try {
      await candidatesApi.moveJob(candidate.id, fromJobId, job.id);
      setApplied(prev => ({ ...prev, [candidate.id]: true }));
      onSuccess && onSuccess(candidate);
    } catch (err) {
      const msg = err.data?.error || err.data?.detail || 'Failed to move candidate';
      setErrors(prev => ({ ...prev, [candidate.id]: msg }));
    } finally {
      setApplying(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[500] p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[80vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <div>
              <p className="text-sm font-semibold text-slate-800">Apply Candidate to Job</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{job.job_code} — {job.title}</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search by name, email or phone…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              />
              {fetching && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {results.length === 0 && !fetching ? (
              <div className="flex flex-col items-center justify-center py-14 text-slate-400 gap-2">
                <User className="w-8 h-8" />
                <p className="text-sm">{search ? 'No candidates found' : 'Start typing to search candidates'}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {results.map(c => {
                  const isApplied  = applied[c.id];
                  const isApplying = applying === c.id;
                  const conflict   = conflicts[c.id];
                  const error      = errors[c.id];

                  return (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {c.full_name?.slice(0, 2).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{c.full_name}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {c.email}
                          {c.total_experience_years != null && ` · ${c.total_experience_years}yr exp`}
                          {c.designation && ` · ${c.designation}`}
                        </p>

                        {/* Conflict row */}
                        {conflict && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-amber-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              Currently in <span className="font-semibold">{conflict.job_code}</span>
                            </span>
                            {isAdmin ? (
                              <button
                                onClick={() => setConfirmMove({ candidate: c, fromJobId: conflict.id, fromJobCode: conflict.job_code })}
                                disabled={isApplying}
                                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-300 hover:border-blue-500 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
                              >
                                {isApplying ? <Loader className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                                Move here
                              </button>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-slate-400 border border-slate-200 bg-slate-50 px-2 py-0.5 rounded-full">
                                <ShieldOff className="w-3 h-3" /> Admin only
                              </span>
                            )}
                            <button
                              onClick={() => setConflicts(prev => ({ ...prev, [c.id]: undefined }))}
                              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {error && (
                          <p className="text-xs text-rose-500 flex items-center gap-1 mt-0.5">
                            <AlertCircle className="w-3 h-3 shrink-0" />{error}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0">
                        {isApplied ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <CheckCircle className="w-3.5 h-3.5" /> Applied
                          </span>
                        ) : !conflict ? (
                          <button
                            onClick={() => handleApply(c)}
                            disabled={isApplying}
                            className="text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            {isApplying ? <><Loader className="w-3 h-3 animate-spin" /> Applying…</> : 'Apply'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Move Confirmation Modal ─────────────────────────────────────── */}
      {confirmMove && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-[600] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Move Candidate?</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  <span className="font-semibold text-slate-700">{confirmMove.candidate.full_name}</span> is currently
                  active in <span className="font-semibold text-amber-700">{confirmMove.fromJobCode}</span>.
                  Moving them will remove all their progress from that job and re-apply them
                  to <span className="font-semibold text-blue-700">{job.job_code} — {job.title}</span> at the
                  Applied stage.
                </p>
                <p className="text-xs text-rose-500 mt-2 font-medium">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setConfirmMove(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => executeMove(confirmMove.candidate, confirmMove.fromJobId)}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <ArrowRight className="w-3.5 h-3.5" /> Yes, Move Candidate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
