import React from 'react';
import Modal from './Modal';

export default function AddNoteModal({ isOpen, onClose, selectedCandidate, noteText, setNoteText, noteLoading, handleSaveNote }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Note" maxWidth="max-w-xl">
      <div className="flex flex-col gap-4">
        {selectedCandidate && (
          <p className="text-sm text-slate-500">
            Note for <span className="font-semibold text-slate-700">{selectedCandidate.full_name}</span>
          </p>
        )}
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Enter note…"
          className="w-full border border-slate-300 rounded-md p-3 text-sm outline-none focus:border-blue-500 min-h-[120px] resize-y"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveNote}
            disabled={noteLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
          >
            {noteLoading ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-md text-sm font-medium transition-colors">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
