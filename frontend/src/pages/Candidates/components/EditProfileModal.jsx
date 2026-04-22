import React from 'react';
import Modal from './Modal';

export default function EditProfileModal({ isOpen, onClose, selectedCandidate, editForm, setEditForm, editLoading, handleEditSave, user }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile" maxWidth="max-w-2xl">
      {selectedCandidate && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700">Full Name *</label>
              <input
                type="text"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700">Phone Number</label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700">Current Location</label>
              <input
                type="text"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700">Total Experience (years)</label>
              <input
                type="number" step="0.1" min="0"
                value={editForm.total_experience_years}
                onChange={(e) => setEditForm({ ...editForm, total_experience_years: e.target.value })}
                className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            {(user?.role === 'admin' || user?.role === 'recruiter') && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Current CTC (Lakhs)</label>
                  <input
                    type="number" min="0" step="0.1"
                    value={editForm.current_ctc_lakhs}
                    onChange={(e) => setEditForm({ ...editForm, current_ctc_lakhs: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
                    placeholder="e.g. 12.5"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Notice Period (days)</label>
                  <input
                    type="number" min="0" step="1"
                    value={editForm.notice_period_days}
                    onChange={(e) => setEditForm({ ...editForm, notice_period_days: e.target.value })}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
                    placeholder="e.g. 30"
                  />
                </div>
              </>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700">Designation</label>
              <input
                type="text"
                value={editForm.designation}
                onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={handleEditSave}
              disabled={editLoading || !editForm.full_name}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {editLoading ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-md text-sm font-medium transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
