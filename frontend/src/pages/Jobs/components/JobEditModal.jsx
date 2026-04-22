import React from 'react';
import { X } from 'lucide-react';

export default function JobEditModal({
  isEditOpen,
  setIsEditOpen,
  jobDetail,
  editForm,
  setEditForm,
  editLoading,
  handleEditSave,
  setIsCloseConfirmOpen,
}) {
  if (!isEditOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[600px] max-w-[92vw] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-800">Edit Job Details</h3>
            <p className="text-xs text-slate-500 mt-0.5">{jobDetail?.job_code} — {jobDetail?.title}</p>
          </div>
          <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-sm font-medium text-slate-700">Job Title</label>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Location</label>
              <input
                type="text"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Status</label>
              {jobDetail?.status === 'closed' ? (
                <div className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                  Closed — no further changes allowed
                </div>
              ) : (
                <select
                  value={editForm.status}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'closed') {
                      setIsCloseConfirmOpen(true);
                    } else {
                      setEditForm({ ...editForm, status: val });
                    }
                  }}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
                >
                  {(jobDetail?.status === 'open'
                    ? ['open', 'closed', 'abandoned']
                    : jobDetail?.status === 'abandoned'
                    ? ['abandoned', 'open', 'closed']
                    : ['open', 'abandoned', 'closed']
                  ).map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Experience Min (yrs)</label>
              <input
                type="number" step="0.5" min="0"
                value={editForm.experience_min}
                onChange={(e) => setEditForm({ ...editForm, experience_min: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Experience Max (yrs)</label>
              <input
                type="number" step="0.5" min="0"
                value={editForm.experience_max}
                onChange={(e) => setEditForm({ ...editForm, experience_max: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Required Skills <span className="font-normal text-slate-400">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={editForm.skills_required}
                onChange={(e) => setEditForm({ ...editForm, skills_required: e.target.value })}
                placeholder="e.g. Python, Django, React"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-sm font-medium text-slate-700">Job Description</label>
              <textarea
                rows={5}
                value={editForm.job_description}
                onChange={(e) => setEditForm({ ...editForm, job_description: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5 pt-3 border-t border-slate-100">
          <button
            onClick={() => setIsEditOpen(false)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleEditSave}
            disabled={editLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {editLoading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
