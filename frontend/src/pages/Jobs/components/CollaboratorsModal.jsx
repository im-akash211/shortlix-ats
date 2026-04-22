import React from 'react';
import { X, Users, UserPlus } from 'lucide-react';
import { useAuth } from '../../../lib/authContext';

export default function CollaboratorsModal({
  isCollabModalOpen,
  setIsCollabModalOpen,
  selectedJob,
  collabList,
  collabLoading,
  collabEmail, setCollabEmail,
  collabSearchResults,
  collabSearchLoading,
  collabActionLoading,
  collabError,
  collabSuccess,
  recruiterUsers,
  collabFilter, setCollabFilter,
  collabInputFocused, setCollabInputFocused,
  handleCollabSearch,
  handleAddCollab,
  handleRemoveCollab,
}) {
  const { user } = useAuth();

  if (!isCollabModalOpen || !selectedJob) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[560px] max-w-[92vw] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Collaborators</h3>
            <p className="text-xs text-slate-500 mt-0.5">{selectedJob.job_code} — {selectedJob.title}</p>
          </div>
          <button onClick={() => setIsCollabModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {collabError && (
            <div className="text-sm px-4 py-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
              {collabError}
            </div>
          )}

          {/* Current collaborators */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" /> Current Collaborators
            </h4>
            {collabLoading ? (
              <p className="text-sm text-slate-400 italic">Loading…</p>
            ) : collabList.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No collaborators assigned yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {collabList.map((c) => (
                  <div key={c.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {c.user_name ? c.user_name.slice(0, 2).toUpperCase() : '?'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{c.user_name}</p>
                        <p className="text-xs text-slate-500">{c.user_email}</p>
                      </div>
                    </div>
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => handleRemoveCollab(c.user)}
                        disabled={collabActionLoading}
                        className="text-xs text-rose-600 hover:text-rose-800 font-medium disabled:opacity-50 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add collaborator — admin only */}
          {user?.role === 'admin' ? (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-slate-400" /> Add Collaborator
              </h4>
              <p className="text-xs text-slate-500 mb-3">Showing recruiters — type to filter by name or email.</p>
              <input
                type="text"
                value={collabFilter}
                onChange={(e) => setCollabFilter(e.target.value)}
                onFocus={() => setCollabInputFocused(true)}
                onBlur={() => setTimeout(() => setCollabInputFocused(false), 150)}
                placeholder="Search recruiters…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              {collabInputFocused && recruiterUsers.length > 0 && (
                <div className="mt-3 flex flex-col gap-2 max-h-52 overflow-y-auto">
                  {recruiterUsers
                    .filter((u) => {
                      const kw = collabFilter.toLowerCase();
                      return !kw || u.full_name?.toLowerCase().includes(kw) || u.email?.toLowerCase().includes(kw);
                    })
                    .map((u) => {
                      const already = collabList.some((c) => c.user === u.id);
                      return (
                        <div key={u.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2.5 bg-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {u.full_name ? u.full_name.slice(0, 2).toUpperCase() : '?'}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{u.full_name}</p>
                              <p className="text-xs text-slate-500">{u.email}</p>
                            </div>
                          </div>
                          {already ? (
                            <span className="text-xs text-slate-400 italic">Already added</span>
                          ) : (
                            <button
                              onClick={() => handleAddCollab(u.id)}
                              disabled={collabActionLoading}
                              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
              {collabSuccess && (
                <p className="mt-2 text-xs text-emerald-600 font-medium">{collabSuccess}</p>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic flex items-center gap-1.5 py-1">
              <Users className="w-3.5 h-3.5" />
              Only admins can add or remove collaborators.
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-2 border-t border-slate-100">
          <button
            onClick={() => setIsCollabModalOpen(false)}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
