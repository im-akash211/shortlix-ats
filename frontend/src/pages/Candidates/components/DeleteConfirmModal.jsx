import React from 'react';
import { Trash2 } from 'lucide-react';

export default function DeleteConfirmModal({ isDeleteOpen, deleteTarget, deleteLoading, setIsDeleteOpen, setDeleteTarget, handleDeleteCandidate }) {
  if (!isDeleteOpen || !deleteTarget) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[440px] max-w-[92vw] p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">Delete Candidate</h3>
            <p className="text-xs text-slate-500 mt-0.5">{deleteTarget.full_name}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Are you sure you want to permanently delete <span className="font-semibold text-slate-800">{deleteTarget.full_name}</span>? This action{' '}
          <span className="font-semibold text-rose-600">cannot be undone</span> and will remove all associated data.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => { setIsDeleteOpen(false); setDeleteTarget(null); }}
            disabled={deleteLoading}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteCandidate}
            disabled={deleteLoading}
            className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {deleteLoading ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
