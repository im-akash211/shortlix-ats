import { CheckCircle2, Circle, Clock } from 'lucide-react';

const ROUND_ORDER = ['R1', 'R2', 'R3', 'CLIENT', 'CDO', 'MGMT'];
const ROUND_LABELS = {
  R1: 'Round 1', R2: 'Round 2', R3: 'Round 3',
  CLIENT: 'Client', CDO: 'CDO', MGMT: 'Management',
};

function formatDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InterviewTimeline({ interviews = [], currentInterviewId }) {
  // Group by round_name, keep latest per round
  const byRound = {};
  interviews.forEach((iv) => {
    const r = iv.round_name;
    if (!r) return;
    if (!byRound[r] || new Date(iv.scheduled_at) > new Date(byRound[r].scheduled_at)) {
      byRound[r] = iv;
    }
  });

  const rounds = ROUND_ORDER.filter((r) => byRound[r]);
  if (rounds.length === 0) return null;

  return (
    <div className="px-5 py-4 border-b border-slate-100">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Interview Timeline</p>
      <div className="flex flex-col gap-0">
        {rounds.map((r, idx) => {
          const iv = byRound[r];
          const cs = iv.computed_status;
          const isCurrent = iv.id === currentInterviewId;
          const isCompleted = cs === 'COMPLETED';
          const isScheduled = cs === 'SCHEDULED';

          return (
            <div key={r} className="flex items-start gap-3">
              {/* Connector */}
              <div className="flex flex-col items-center">
                <div className={`mt-0.5 rounded-full flex items-center justify-center w-6 h-6 shrink-0 ${
                  isCompleted
                    ? 'text-emerald-500'
                    : isCurrent
                    ? 'text-blue-500'
                    : 'text-slate-300'
                }`}>
                  {isCompleted
                    ? <CheckCircle2 className="w-5 h-5" />
                    : isCurrent
                    ? <Clock className="w-5 h-5" />
                    : <Circle className="w-5 h-5" />}
                </div>
                {idx < rounds.length - 1 && (
                  <div className={`w-px flex-1 min-h-[16px] mt-0.5 ${isCompleted ? 'bg-emerald-200' : 'bg-slate-200'}`} />
                )}
              </div>

              {/* Content */}
              <div className={`pb-4 flex-1 ${isCurrent ? 'font-semibold' : ''}`}>
                <p className={`text-sm ${isCompleted ? 'text-emerald-700' : isCurrent ? 'text-blue-700' : 'text-slate-400'}`}>
                  {ROUND_LABELS[r] || r}
                  {isCurrent && <span className="ml-2 text-xs font-normal bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Current</span>}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDate(iv.scheduled_at)}</p>
                {iv.round_result && (
                  <span className={`text-xs font-medium mt-0.5 inline-block ${
                    iv.round_result === 'PASS' ? 'text-emerald-600' :
                    iv.round_result === 'FAIL' ? 'text-rose-600' : 'text-amber-600'
                  }`}>
                    {iv.round_result}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
