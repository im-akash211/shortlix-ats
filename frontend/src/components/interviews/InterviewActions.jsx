import { AlertTriangle, CheckCircle2, Calendar, X } from 'lucide-react';
import { interviews as interviewsApi } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export default function InterviewActions({ interview, role, hasFeedback, onCancelClick, onEditClick }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(null);

  const cs = interview.computed_status;
  const isScheduled = cs === 'SCHEDULED';
  const isCompleted = cs === 'COMPLETED';
  const isTimePassed = interview.status === 'scheduled' && new Date(interview.scheduled_at) < new Date();

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
      {/* Time-passed warning */}
      {isTimePassed && isScheduled && (
        <div className="w-full flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium mb-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Interview time has passed — please mark as completed
        </div>
      )}

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
