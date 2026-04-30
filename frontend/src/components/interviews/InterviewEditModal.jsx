import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { interviews as interviewsApi, users as usersApi } from '../../lib/api';

const ROUND_OPTIONS = [
  { value: 'R1',     label: 'Round 1'         },
  { value: 'R2',     label: 'Round 2'         },
  { value: 'R3',     label: 'Round 3'         },
  { value: 'CLIENT', label: 'Client Round'    },
  { value: 'CDO',    label: 'CDO Round'       },
  { value: 'MGMT',   label: 'Management Round'},
];

const MODE_OPTIONS = [
  { value: 'virtual',      label: 'Virtual'      },
  { value: 'phone',        label: 'Phone Call'   },
  { value: 'face_to_face', label: 'Face-to-Face' },
];

function toLocalDatetimeValue(isoString) {
  if (!isoString) return '';
  // datetime-local input expects "YYYY-MM-DDTHH:MM"
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function InterviewEditModal({ interview, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    scheduled_at: toLocalDatetimeValue(interview.scheduled_at),
    duration_minutes: interview.duration_minutes ?? 60,
    interviewer: interview.interviewer ?? '',
    mode: interview.mode ?? 'virtual',
    meeting_link: interview.meeting_link ?? '',
    round_name: interview.round_name ?? '',
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Fetch interviewers for the dropdown
  const { data: interviewersList } = useQuery({
    queryKey: ['users', 'interviewer-dropdown'],
    queryFn: () => usersApi.list({ role: 'interviewer' }),
    staleTime: 5 * 60 * 1000,
  });
  const interviewers = interviewersList?.results ?? interviewersList ?? [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.scheduled_at) { setError('Scheduled date/time is required.'); return; }
    if (!form.interviewer)   { setError('Please select an interviewer.'); return; }

    setLoading(true);
    try {
      // Convert local datetime back to ISO for the API
      const scheduledAt = new Date(form.scheduled_at).toISOString();
      await interviewsApi.update(interview.id, {
        scheduled_at: scheduledAt,
        duration_minutes: Number(form.duration_minutes),
        interviewer: form.interviewer,
        mode: form.mode,
        meeting_link: form.meeting_link,
        ...(form.round_name ? { round_name: form.round_name } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      onSaved?.();
      onClose();
    } catch (err) {
      const detail = err.data?.detail || err.data?.scheduled_at?.[0] || JSON.stringify(err.data) || 'Failed to update interview.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50">
      <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-[95vw] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">Edit Interview</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {interview.candidate_name} · {interview.round_label || interview.round_name}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Scheduled Date/Time */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Scheduled Date &amp; Time <span className="text-rose-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={set('scheduled_at')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              required
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Duration (minutes)</label>
            <input
              type="number"
              min={15}
              max={480}
              step={15}
              value={form.duration_minutes}
              onChange={set('duration_minutes')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>

          {/* Interviewer */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Interviewer <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.interviewer}
              onChange={set('interviewer')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
              required
            >
              <option value="">Select interviewer…</option>
              {interviewers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Interview Mode</label>
            <select
              value={form.mode}
              onChange={set('mode')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
            >
              {MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Round */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Round</label>
            <select
              value={form.round_name}
              onChange={set('round_name')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">— keep current —</option>
              {ROUND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Meeting Link */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Meeting Link</label>
            <input
              type="url"
              value={form.meeting_link}
              onChange={set('meeting_link')}
              placeholder="https://meet.google.com/…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
