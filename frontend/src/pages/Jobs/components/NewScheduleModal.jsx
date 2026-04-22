import React from 'react';
import { ROUND_LABELS, ROUND_PROGRESSION } from '../constants';

export default function NewScheduleModal({
  scheduleModalCandidate,
  scheduleModalRound,
  setScheduleModalCandidate,
  setScheduleModalRound,
  scheduleForm,
  setScheduleForm,
  scheduleSubmitting,
  usersList,
  usersLoading,
  handleNewScheduleSubmit,
}) {
  if (!scheduleModalCandidate) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[400]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          Schedule {ROUND_LABELS[scheduleModalRound] || scheduleModalRound} Interview
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Interviewer *</label>
            <select
              value={scheduleForm.interviewer}
              onChange={(e) => setScheduleForm(f => ({ ...f, interviewer: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">{usersLoading ? 'Loading…' : 'Select interviewer…'}</option>
              {usersList.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date &amp; Time *</label>
            <input
              type="datetime-local"
              value={scheduleForm.scheduled_at}
              onChange={(e) => setScheduleForm(f => ({ ...f, scheduled_at: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mode</label>
            <select
              value={scheduleForm.mode}
              onChange={(e) => setScheduleForm(f => ({ ...f, mode: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="virtual">Virtual</option>
              <option value="phone">Phone</option>
              <option value="face_to_face">In-person</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Duration (min)</label>
              <input
                type="number"
                min="15"
                step="15"
                value={scheduleForm.duration_minutes}
                onChange={(e) => setScheduleForm(f => ({ ...f, duration_minutes: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Meeting Link</label>
              <input
                type="url"
                placeholder="https://..."
                value={scheduleForm.meeting_link}
                onChange={(e) => setScheduleForm(f => ({ ...f, meeting_link: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={() => {
              setScheduleModalCandidate(null);
              setScheduleModalRound(null);
              setScheduleForm({ round_number: 1, round_label: '', interviewer: '', scheduled_at: '', duration_minutes: 60, mode: 'virtual', meeting_link: '' });
            }}
            className="text-sm px-4 py-2 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleNewScheduleSubmit}
            disabled={scheduleSubmitting}
            className="text-sm px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {scheduleSubmitting ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
