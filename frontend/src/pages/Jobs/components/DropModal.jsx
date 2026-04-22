import React from 'react';
import { X } from 'lucide-react';

export default function DropModal({
  dropModalCandidate,
  setDropModalCandidate,
  dropReason,
  setDropReason,
  dropLoading,
  handleDropConfirm,
}) {
  if (!dropModalCandidate) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[400]">
      <div className="bg-white rounded-xl shadow-2xl w-[420px] max-w-[92vw] p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Drop Candidate</h3>
          <button onClick={() => setDropModalCandidate(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Drop <strong>{dropModalCandidate.candidate_name}</strong> from this job?
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Reason</label>
          <select
            value={dropReason}
            onChange={(e) => setDropReason(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
          >
            <option value="REJECTED">Rejected</option>
            <option value="CANDIDATE_DROP">Candidate Drop</option>
            <option value="NO_SHOW">No Show</option>
          </select>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setDropModalCandidate(null)}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDropConfirm}
            disabled={dropLoading}
            className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium disabled:opacity-50 transition-colors"
          >
            {dropLoading ? 'Dropping…' : 'Confirm Drop'}
          </button>
        </div>
      </div>
    </div>
  );
}
