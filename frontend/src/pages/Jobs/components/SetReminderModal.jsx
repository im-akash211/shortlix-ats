import React, { useState } from 'react';
import { Bell, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { remindersApi } from '../../../lib/api';

const STAGE_LABEL = {
  APPLIED: 'Applied',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  OFFERED: 'Offered',
  JOINED: 'Joined',
  DROPPED: 'Dropped',
};

export default function SetReminderModal({ candidate, onClose }) {
  const toLocalDT = (date) => {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  const defaultDT = toLocalDT(now);

  const [remindAt, setRemindAt] = useState(defaultDT);
  const [note, setNote]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  if (!candidate) return null;

  const handleSubmit = async () => {
    if (!remindAt) { setError('Please select a date and time.'); return; }
    if (new Date(remindAt) <= new Date()) { setError('Reminder must be in the future.'); return; }
    setLoading(true);
    setError('');
    try {
      await remindersApi.create(candidate.candidate, {
        remind_at: new Date(remindAt).toISOString(),
        note: note.trim(),
        mapping: candidate.id, // CandidateJobMapping UUID
      });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.data?.detail || err.data?.remind_at?.[0] || 'Failed to set reminder.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{candidate.candidate_name}</p>
            <p className="text-xs text-slate-400">
              {candidate.job_title || 'No job'} · {STAGE_LABEL[candidate.macro_stage] || candidate.macro_stage}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-700">Reminder set!</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={remindAt}
                  min={toLocalDT(new Date())}
                  onChange={e => setRemindAt(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Note <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="e.g. Follow up on salary discussion"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 resize-none"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  Set Reminder
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
