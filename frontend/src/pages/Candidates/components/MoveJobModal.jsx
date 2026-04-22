import React from 'react';
import { ChevronDown } from 'lucide-react';
import Modal from './Modal';

export default function MoveJobModal({ isOpen, onClose, moveJobId, setMoveJobId, allJobs, handleMove }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Move applicant to a job" maxWidth="max-w-xl">
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
          <button onClick={handleMove} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors">Move</button>
          <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-md text-sm font-medium transition-colors">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
