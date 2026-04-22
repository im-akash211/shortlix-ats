import React from 'react';
import { X } from 'lucide-react';

export default function ScheduleModal({
  isScheduleOpen,
  scheduleCandidate,
  scheduleForm,
  setScheduleForm,
  scheduleLoading,
  scheduleToast,
  usersList,
  closeScheduleModal,
  handleScheduleSubmit,
}) {
  if (!isScheduleOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[580px] max-w-[92vw]">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">Schedule Interview</h3>
          <button onClick={closeScheduleModal} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {scheduleToast && (
            <div className={`text-sm px-4 py-3 rounded-lg font-medium ${scheduleToast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
              {scheduleToast.message}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Candidate</label>
            <div className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 bg-slate-50">
              {scheduleCandidate?.candidate_name || '—'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Round</label>
              <select value={scheduleForm.round_label} onChange={(e) => setScheduleForm({ ...scheduleForm, round_label: e.target.value, round_number: e.target.selectedIndex })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white">
                <option value="">Select round…</option>
                <option value="Screening Round">Screening Round</option>
                <option value="Technical Round 1">Technical Round 1</option>
                <option value="Technical Round 2">Technical Round 2</option>
                <option value="Managerial Round">Managerial Round</option>
                <option value="HR Round">HR Round</option>
                <option value="Final Round">Final Round</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Interviewer *</label>
              <select value={scheduleForm.interviewer} onChange={(e) => setScheduleForm({ ...scheduleForm, interviewer: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white">
                <option value="">Select interviewer…</option>
                {usersList.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Date *</label>
              <input
                type="date"
                value={scheduleForm.scheduled_at ? scheduleForm.scheduled_at.split('T')[0] : ''}
                onChange={(e) => {
                  const time = scheduleForm.scheduled_at ? scheduleForm.scheduled_at.split('T')[1] : '00:00';
                  setScheduleForm({ ...scheduleForm, scheduled_at: `${e.target.value}T${time}` });
                }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Time *</label>
              <input
                type="time"
                value={scheduleForm.scheduled_at ? scheduleForm.scheduled_at.split('T')[1] : ''}
                onChange={(e) => {
                  const date = scheduleForm.scheduled_at ? scheduleForm.scheduled_at.split('T')[0] : '';
                  setScheduleForm({ ...scheduleForm, scheduled_at: `${date}T${e.target.value}` });
                }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Duration (minutes)</label>
              <input type="number" min="15" step="15" value={scheduleForm.duration_minutes} onChange={(e) => setScheduleForm({ ...scheduleForm, duration_minutes: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Mode</label>
              <select value={scheduleForm.mode} onChange={(e) => setScheduleForm({ ...scheduleForm, mode: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white">
                <option value="virtual">Virtual</option>
                <option value="phone">Phone</option>
                <option value="face_to_face">Face to Face</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Meeting Link <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="text" placeholder="https://meet.google.com/..." value={scheduleForm.meeting_link} onChange={(e) => setScheduleForm({ ...scheduleForm, meeting_link: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={closeScheduleModal} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
          <button
            onClick={handleScheduleSubmit}
            disabled={scheduleLoading || !scheduleForm.interviewer || !scheduleForm.scheduled_at}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {scheduleLoading ? 'Scheduling…' : 'Schedule Interview'}
          </button>
        </div>
      </div>
    </div>
  );
}
