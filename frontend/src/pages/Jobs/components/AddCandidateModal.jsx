import React from 'react';
import { X } from 'lucide-react';

export default function AddCandidateModal({
  isAddProfileOpen,
  setIsAddProfileOpen,
  setAddProfileTargetJob,
  addForm,
  setAddForm,
  addLoading,
  handleAddProfile,
}) {
  if (!isAddProfileOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[560px] max-w-[92vw]">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">Add Profile Manually</h3>
          <button onClick={() => { setIsAddProfileOpen(false); setAddProfileTargetJob(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-sm font-medium text-slate-700">Full Name *</label>
              <input type="text" value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Email *</label>
              <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Phone</label>
              <input type="tel" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Location</label>
              <input type="text" value={addForm.location} onChange={(e) => setAddForm({ ...addForm, location: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Experience (years)</label>
              <input type="number" step="0.1" value={addForm.total_experience_years} onChange={(e) => setAddForm({ ...addForm, total_experience_years: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => { setIsAddProfileOpen(false); setAddProfileTargetJob(null); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            <button onClick={handleAddProfile} disabled={addLoading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {addLoading ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
