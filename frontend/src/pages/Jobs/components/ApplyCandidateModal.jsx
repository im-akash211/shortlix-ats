import React, { useState, useEffect, useRef } from 'react';
import { Search, User, CheckCircle, AlertCircle, Loader, X, ArrowRight, Briefcase, Tag, MapPin, Layers } from 'lucide-react';
import { candidates as candidatesApi } from '../../../lib/api';

const STAGE_COLORS = {
  APPLIED:    'bg-blue-100 text-blue-700',
  SHORTLISTED:'bg-violet-100 text-violet-700',
  INTERVIEW:  'bg-amber-100 text-amber-700',
  OFFER:      'bg-emerald-100 text-emerald-700',
  JOINED:     'bg-green-100 text-green-700',
  DROPPED:    'bg-rose-100 text-rose-700',
};

function CandidateTooltip({ candidate: c, rect }) {
  const skills = Array.isArray(c.skills) ? c.skills.slice(0, 5) : [];
  const tags   = Array.isArray(c.tags)   ? c.tags.slice(0, 3)   : [];
  if (!rect) return null;
  const top = Math.min(rect.top, window.innerHeight - 280);
  return (
    <div
      className="fixed z-[9999] w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-3.5 pointer-events-none"
      style={{ top, left: rect.right + 8 }}
    >
      {/* Name + source */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="text-sm font-semibold text-slate-800 leading-snug">{c.full_name}</p>
        {c.source && (
          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full shrink-0 capitalize">
            {c.source.replace('_', ' ')}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-slate-500">
        {/* Designation + employer */}
        {c.designation && (
          <span className="flex items-center gap-1.5 truncate">
            <Briefcase className="w-3 h-3 shrink-0 text-slate-400" />
            {c.designation}{c.current_employer ? ` @ ${c.current_employer}` : ''}
          </span>
        )}

        {/* Experience + location */}
        <div className="flex items-center gap-3">
          {c.total_experience_years != null && (
            <span className="flex items-center gap-1">
              <span className="font-bold text-slate-700">{c.total_experience_years}</span> yrs exp
            </span>
          )}
          {c.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
              {c.location}
            </span>
          )}
        </div>

        {/* Current pipeline status */}
        {c.current_job && (
          <span className="flex items-center gap-1.5 truncate">
            <Layers className="w-3 h-3 shrink-0 text-slate-400" />
            <span className="truncate">{c.current_job.job_code} — {c.current_job.title}</span>
            {c.current_stage && (
              <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STAGE_COLORS[c.current_stage] || 'bg-slate-100 text-slate-600'}`}>
                {c.current_stage}
              </span>
            )}
          </span>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <div className="flex items-start gap-1.5 mt-0.5">
            <Tag className="w-3 h-3 shrink-0 text-slate-400 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {skills.map(s => (
                <span key={s} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium">{s}</span>
              ))}
              {Array.isArray(c.skills) && c.skills.length > 5 && (
                <span className="text-slate-400 text-[10px]">+{c.skills.length - 5} more</span>
              )}
            </div>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {tags.map(t => (
              <span key={t} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApplyCandidateModal({ job, onClose, onSuccess }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [applying, setApplying] = useState(null); // candidate id being applied/moved
  const [applied, setApplied] = useState({}); // { [candidateId]: true }
  const [conflicts, setConflicts] = useState({}); // { [candidateId]: { id, title, job_code } }
  const [errors, setErrors] = useState({}); // { [candidateId]: message }
  const [hovered, setHovered] = useState(null); // { id, rect }
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

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

  const handleMove = async (candidate, fromJobId) => {
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
            {fetching && (
              <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
            )}
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
                const isApplied = applied[c.id];
                const isApplying = applying === c.id;
                const conflict = conflicts[c.id];
                const error = errors[c.id];
                return (
                  <div
                    key={c.id}
                    className="relative flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                    onMouseEnter={e => setHovered({ id: c.id, rect: e.currentTarget.getBoundingClientRect() })}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {c.full_name?.slice(0, 2).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.full_name}</p>
                      <p className="text-xs text-slate-400 truncate">{c.email}</p>
                      {conflict && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            Currently in <span className="font-semibold">{conflict.job_code}</span>
                          </span>
                          <button
                            onClick={() => handleMove(c, conflict.id)}
                            disabled={isApplying}
                            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-300 hover:border-blue-500 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
                          >
                            {isApplying ? <Loader className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                            Move here
                          </button>
                          <button
                            onClick={() => setConflicts(prev => ({ ...prev, [c.id]: undefined }))}
                            className="text-xs text-slate-400 hover:text-slate-600"
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
      {hovered && results.find(c => c.id === hovered.id) && (
        <CandidateTooltip candidate={results.find(c => c.id === hovered.id)} rect={hovered.rect} />
      )}
    </div>
  );
}
