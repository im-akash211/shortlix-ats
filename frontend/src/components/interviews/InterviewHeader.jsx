import { X, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes/constants';

const ROUND_LABELS = {
  R1: 'Round 1', R2: 'Round 2', R3: 'Round 3',
  CLIENT: 'Client Round', CDO: 'CDO Round', MGMT: 'Management Round',
};

const STATUS_BADGE = {
  SCHEDULED: { label: 'Scheduled', bg: 'bg-blue-100',    text: 'text-blue-700'    },
  COMPLETED: { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  ON_HOLD:   { label: 'On Hold',   bg: 'bg-amber-100',   text: 'text-amber-700'   },
  CANCELLED: { label: 'Cancelled', bg: 'bg-slate-100',   text: 'text-slate-500'   },
};

function formatSchedule(scheduledAt, endTime, durationMin) {
  const start = new Date(scheduledAt);
  const end = endTime ? new Date(endTime) : new Date(start.getTime() + (durationMin || 60) * 60000);
  const date  = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const startT = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const endT   = end.toLocaleTimeString('en-US',   { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date}  ${startT} – ${endT}`;
}

function resolveStatus(iv) {
  if (iv.status === 'cancelled') return 'CANCELLED';
  // Auto-complete: if scheduled time has passed, treat as completed regardless of stored status
  const endTime = iv.end_time
    ? new Date(iv.end_time)
    : new Date(new Date(iv.scheduled_at).getTime() + (iv.duration_minutes || 60) * 60000);
  if (endTime < new Date()) return 'COMPLETED';
  return iv.computed_status || 'SCHEDULED';
}

export default function InterviewHeader({ interview, onClose, canEdit, onEditClick }) {
  const navigate = useNavigate();

  const cs = resolveStatus(interview);

  const badge = STATUS_BADGE[cs] || STATUS_BADGE.SCHEDULED;
  const roundLabel = ROUND_LABELS[interview.round_name] || interview.round_label;

  return (
    <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3 sticky top-0 z-10">
      <div className="min-w-0 flex-1">
        {/* Candidate name — click → profile */}
        <button
          onClick={() => {
            onClose();
            navigate(ROUTES.CANDIDATES.PROFILE(interview.candidate_id));
          }}
          className="font-semibold text-slate-800 hover:text-blue-600 hover:underline text-left truncate max-w-[220px] block"
          title={interview.candidate_name}
        >
          {interview.candidate_name}
        </button>

        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {interview.job_title}
          {interview.job_code && <span className="ml-1 text-slate-400">· {interview.job_code}</span>}
        </p>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {roundLabel && (
            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {roundLabel}
            </span>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        </div>

        <p className="text-xs text-slate-500 mt-1.5">
          {formatSchedule(interview.scheduled_at, interview.end_time, interview.duration_minutes)}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {canEdit && (
          <button
            onClick={onEditClick}
            title="Edit interview"
            className="p-1.5 hover:bg-blue-100 rounded-full text-blue-500 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-200 rounded-full text-slate-400"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
