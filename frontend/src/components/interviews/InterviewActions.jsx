import { CheckCircle2, Calendar, X } from 'lucide-react';
import { interviews as interviewsApi } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export default function InterviewActions({ interview, role, hasFeedback, onCancelClick, onEditClick }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(null);

  const endTime = interview.end_time
    ? new Date(interview.end_time)
    : new Date(new Date(interview.scheduled_at).getTime() + (interview.duration_minutes || 60) * 60000);
  const autoCompleted = endTime < new Date();
  const cs = autoCompleted ? 'COMPLETED' : (interview.computed_status || 'SCHEDULED');
  const isScheduled = cs === 'SCHEDULED';
  const isCompleted = cs === 'COMPLETED';

  const canManage = role === 'admin' || role === 'recruiter';
  const canCancel = role === 'admin';

  const markCompleted = async () => {
    setLoading('complete');
    try {
      await interviewsApi.setRoundStatus(interview.id, 'COMPLETED');
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
    } catch (err) {
      alert(err.data?.error || 'Failed to mark as completed.');
    } finally {
      setLoading(null);
    }
  };

  if (interview.status === 'cancelled') {
    return (
      <div className="px-5 py-3 border-b border-slate-100">
        <span className="text-xs text-rose-500 font-medium">Interview cancelled</span>
      </div>
    );
  }

  return (
    <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2">
      {isScheduled && (
        <>
          <button
            onClick={markCompleted}
            disabled={loading === 'complete'}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {loading === 'complete' ? 'Saving…' : 'Mark Completed'}
          </button>

          {canManage && (
            <button
              onClick={onEditClick}
              className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              Reschedule / Edit
            </button>
          )}

          {canCancel && (
            <button
              onClick={onCancelClick}
              className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}
        </>
      )}

      {isCompleted && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Interview completed
          {!hasFeedback && (
            <span className="ml-2 text-slate-400">· feedback pending</span>
          )}
        </div>
      )}
    </div>
  );
}
