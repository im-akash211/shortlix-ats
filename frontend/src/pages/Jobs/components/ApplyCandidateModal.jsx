import React, { useState, useEffect, useRef } from 'react';
import { Search, User, CheckCircle, AlertCircle, Loader, X } from 'lucide-react';
import { candidates as candidatesApi } from '../../../lib/api';

export default function ApplyCandidateModal({ job, onClose, onSuccess }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [applying, setApplying] = useState(null); // candidate id being applied
  const [applied, setApplied] = useState({}); // { [candidateId]: true }
  const [errors, setErrors] = useState({}); // { [candidateId]: message }
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
    try {
      await candidatesApi.assignJob(candidate.id, job.id);
      setApplied(prev => ({ ...prev, [candidate.id]: true }));
      onSuccess && onSuccess(candidate);
    } catch (err) {
      const msg = err.data?.error || err.data?.detail || 'Failed to apply';
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
                const error = errors[c.id];
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
                      ) : (
                        <button
                          onClick={() => handleApply(c)}
                          disabled={isApplying}
                          className="text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          {isApplying ? <><Loader className="w-3 h-3 animate-spin" /> Applying…</> : 'Apply'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
