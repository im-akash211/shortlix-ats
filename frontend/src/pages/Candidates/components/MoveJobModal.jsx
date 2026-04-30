import React, { useState } from 'react';
import { ChevronDown, AlertTriangle, ArrowRight } from 'lucide-react';
import Modal from './Modal';

export default function MoveJobModal({ isOpen, onClose, moveJobId, setMoveJobId, allJobs, handleMove, selectedCandidate }) {
  const [confirming, setConfirming] = useState(false);

  const selectedJob = allJobs.find((j) => j.id === moveJobId);

  const onMoveClick = () => {
    if (!moveJobId) return;
    setConfirming(true);
  };

  const onConfirm = async () => {
    setConfirming(false);
    await handleMove();
  };

  const onCancel = () => {
    setConfirming(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Move applicant to a job" maxWidth="max-w-xl">
      {!confirming ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">Select job to move to</label>
            <div className="relative">
              <select
                value={moveJobId}
                onChange={(e) => setMoveJobId(e.target.value)}
                className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">Select a job…</option>
                {allJobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.job_code} — {j.title} ({j.location})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onMoveClick}
              disabled={!moveJobId}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Move
            </button>
            <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-md text-sm font-medium transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Confirm Move</p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {selectedCandidate && (
                  <><span className="font-semibold text-slate-700">{selectedCandidate.full_name}</span> will be removed from their current job and re-applied to </>
                )}
                <span className="font-semibold text-blue-700">
                  {selectedJob ? `${selectedJob.job_code} — ${selectedJob.title}` : 'the selected job'}
                </span>{' '}
                at the <span className="font-semibold">Applied</span> stage.
              </p>
              <p className="text-xs text-rose-500 font-medium mt-2">
                All pipeline progress in the current job will be lost. This cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 justify-end">
            <button onClick={onCancel} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-md text-sm font-medium transition-colors">
              Go Back
            </button>
            <button
              onClick={onConfirm}
              className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1.5"
            >
              <ArrowRight className="w-3.5 h-3.5" /> Yes, Move Candidate
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
