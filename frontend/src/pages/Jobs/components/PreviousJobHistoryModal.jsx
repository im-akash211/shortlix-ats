import React from 'react';
import { X, Briefcase, MoveRight, CheckCircle2 } from 'lucide-react';

const STAGE_ORDER = ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'JOINED'];

const STAGE_LABELS = {
  APPLIED:     'Applied',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW:   'Interview',
  OFFERED:     'Offered',
  JOINED:      'Joined',
  DROPPED:     'Dropped',
};

const ROUND_LABELS = {
  R1: 'R1', R2: 'R2', R3: 'R3', R4: 'R4',
  HR: 'HR', CLIENT: 'Client', TECHNICAL: 'Tech',
};

const DROP_REASON_LABELS = {
  REJECTED:       'Rejected by recruiter',
  CANDIDATE_DROP: 'Dropped by candidate',
  NO_SHOW:        'No show',
};

function fmt(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getReachedStages(stageLogs = [], macroStage) {
  const reached = new Set(['APPLIED']);
  (stageLogs || []).forEach((l) => {
    if (l.to_macro_stage && l.to_macro_stage !== 'DROPPED') reached.add(l.to_macro_stage);
  });
  if (macroStage && macroStage !== 'DROPPED') reached.add(macroStage);
  return reached;
}

function getFinalOutcome(prevMapping) {
  const { macro_stage, drop_reason, interview_status, current_interview_round, action_reason } = prevMapping;

  if (macro_stage === 'JOINED') return { label: 'Joined', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (macro_stage === 'OFFERED') return { label: 'Offered (in progress)', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' };

  if (macro_stage === 'DROPPED') {
    if (drop_reason === 'CANDIDATE_DROP') {
      return { label: 'Dropped by candidate', color: 'bg-rose-50 text-rose-700 border-rose-200', reason: action_reason || null };
    }
    return { label: `Dropped${drop_reason ? ` · ${DROP_REASON_LABELS[drop_reason] || drop_reason}` : ''}`, color: 'bg-rose-50 text-rose-700 border-rose-200', reason: action_reason || null };
  }

  if (interview_status === 'REJECTED') {
    const round = current_interview_round ? ` (${ROUND_LABELS[current_interview_round] || current_interview_round})` : '';
    return { label: `Rejected at Interview${round}`, color: 'bg-rose-50 text-rose-700 border-rose-200', reason: action_reason || null };
  }

  if (macro_stage === 'INTERVIEW') return { label: 'Interview (in progress)', color: 'bg-purple-50 text-purple-700 border-purple-200' };
  if (macro_stage === 'SHORTLISTED') return { label: 'Shortlisted', color: 'bg-blue-50 text-blue-700 border-blue-200' };

  return { label: STAGE_LABELS[macro_stage] || macro_stage, color: 'bg-slate-100 text-slate-600 border-slate-200' };
}

function StageBreadcrumb({ stageLogs, macroStage, currentInterviewRound }) {
  const reached = getReachedStages(stageLogs, macroStage);
  const lastStage = macroStage === 'DROPPED'
    ? (stageLogs?.length > 0 ? stageLogs[stageLogs.length - 1]?.from_macro_stage || 'APPLIED' : 'APPLIED')
    : macroStage;

  return (
    <div>
      <div className="flex items-center gap-1 flex-wrap">
        {STAGE_ORDER.map((stage, idx) => {
          const isReached = reached.has(stage);
          const isLast = stage === lastStage;
          return (
            <React.Fragment key={stage}>
              <div className="flex flex-col items-center gap-0.5">
                <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                  isReached
                    ? isLast && macroStage !== 'JOINED'
                      ? 'bg-violet-100 text-violet-700 border-violet-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                    : 'bg-white text-slate-300 border-slate-100'
                }`}>
                  {isReached
                    ? <span className={`w-1.5 h-1.5 rounded-full inline-block ${isLast && macroStage !== 'JOINED' ? 'bg-violet-500' : 'bg-slate-400'}`} />
                    : <span className="w-1.5 h-1.5 rounded-full inline-block border border-slate-300" />
                  }
                  {STAGE_LABELS[stage]}
                </div>
              </div>
              {idx < STAGE_ORDER.length - 1 && (
                <span className={`text-[10px] ${reached.has(STAGE_ORDER[idx + 1]) ? 'text-slate-400' : 'text-slate-200'}`}>→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {lastStage && (
        <p className="text-[10px] text-slate-400 mt-1">
          Last stage: <span className="font-medium text-slate-500">{STAGE_LABELS[lastStage] || lastStage}</span>
          {currentInterviewRound && lastStage === 'INTERVIEW' && (
            <span className="ml-1">({ROUND_LABELS[currentInterviewRound] || currentInterviewRound})</span>
          )}
        </p>
      )}
    </div>
  );
}

function JobHistoryCard({ prevMapping, movedToJobTitle, movedOn, movedByName }) {
  const outcome = getFinalOutcome(prevMapping);
  const reachedInterview = getReachedStages(prevMapping.stage_logs, prevMapping.macro_stage).has('INTERVIEW');
  const lr = prevMapping.latest_round;

  return (
    <div className="flex flex-col gap-3">

      {/* 1. Context Header */}
      <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {prevMapping.job_code && <span className="text-slate-400 font-normal text-xs mr-1">#{prevMapping.job_code}</span>}
              {prevMapping.job_title}
            </p>
            {prevMapping.department_name && (
              <p className="text-[10px] text-slate-400 mt-0.5">{prevMapping.department_name}</p>
            )}
            <p className="text-[10px] text-slate-400 mt-1">
              {fmt(prevMapping.created_at)}
              {(prevMapping.archived_at || movedOn) && (
                <> → {fmt(prevMapping.archived_at || movedOn)}</>
              )}
            </p>
          </div>
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${outcome.color}`}>
            {outcome.label}
          </span>
        </div>
        {(prevMapping.hiring_manager_name || prevMapping.recruiter_name) && (
          <div className="flex gap-3 mt-2 flex-wrap">
            {prevMapping.hiring_manager_name && (
              <span className="text-[10px] text-slate-400">
                HM: <span className="text-slate-600 font-medium">{prevMapping.hiring_manager_name}</span>
              </span>
            )}
            {prevMapping.recruiter_name && (
              <span className="text-[10px] text-slate-400">
                Recruiter: <span className="text-slate-600 font-medium">{prevMapping.recruiter_name}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. Stage Journey Breadcrumb */}
      <div className="px-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Stage Journey</p>
        <StageBreadcrumb
          stageLogs={prevMapping.stage_logs}
          macroStage={prevMapping.macro_stage}
          currentInterviewRound={prevMapping.current_interview_round}
        />
      </div>

      {/* 3. Final Outcome */}
      <div className="px-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Final Outcome</p>
        <div className="flex flex-col gap-1">
          <span className={`self-start text-[11px] font-semibold px-2.5 py-1 rounded-full border ${outcome.color}`}>
            {outcome.label}
          </span>
          {outcome.reason && (
            <p className="text-[11px] text-slate-500 mt-0.5">
              Reason: <span className="font-medium text-slate-600">{outcome.reason}</span>
            </p>
          )}
        </div>
      </div>

      {/* 4. Interview Insights (only if reached) */}
      {reachedInterview && (
        <div className="px-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Interview Insights</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-purple-50 rounded-lg px-2.5 py-2 border border-purple-100">
              <p className="text-[9px] text-purple-400 font-semibold uppercase tracking-wide mb-0.5">Last Round</p>
              <p className="text-[11px] font-bold text-purple-700">
                {ROUND_LABELS[prevMapping.current_interview_round] || prevMapping.current_interview_round || '—'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100">
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Status</p>
              <p className="text-[11px] font-bold text-slate-700">
                {lr?.round_status ? lr.round_status.replace('_', ' ') : '—'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100">
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Result</p>
              <p className={`text-[11px] font-bold ${
                prevMapping.interview_status === 'REJECTED' ? 'text-rose-600' :
                lr?.round_status === 'COMPLETED' ? 'text-emerald-600' :
                lr?.round_status === 'ON_HOLD' ? 'text-amber-600' : 'text-slate-700'
              }`}>
                {prevMapping.interview_status === 'REJECTED' ? 'Rejected' :
                  lr?.round_status === 'COMPLETED' ? 'Pass' :
                  lr?.round_status === 'ON_HOLD' ? 'On Hold' : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. Movement Info */}
      {(movedToJobTitle || movedOn || movedByName) && (
        <div className="flex items-start gap-2.5 bg-violet-50 border border-violet-100 rounded-xl px-3.5 py-2.5">
          <MoveRight className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wide">Moved to current job</p>
            {movedToJobTitle && (
              <p className="text-[11px] text-slate-700 font-medium">{movedToJobTitle}</p>
            )}
            <div className="flex gap-3 flex-wrap mt-0.5">
              {movedOn && <span className="text-[10px] text-slate-500">On: <span className="font-medium">{fmt(movedOn)}</span></span>}
              {movedByName && <span className="text-[10px] text-slate-500">By: <span className="font-medium">{movedByName}</span></span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreviousJobHistoryModal({ mapping, onClose }) {
  if (!mapping?.previous_mapping) return null;

  // Build chain: oldest first
  const chain = [];
  let cursor = mapping;
  while (cursor.previous_mapping) {
    chain.push(cursor.previous_mapping);
    cursor = cursor.previous_mapping;
  }
  chain.reverse();

  // For movement info on each card, we need the "next" mapping in chain (the one it moved to)
  // chain[0] is oldest → moved into chain[1] → ... → moved into mapping (current)
  const movedToList = [...chain.slice(1).map(m => ({
    jobTitle: m.job_title,
    movedOn: m.created_at,
    movedByName: null,
  })), {
    jobTitle: mapping.job_title,
    movedOn: mapping.created_at,
    movedByName: null,
  }];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[600] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh]">

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <Briefcase className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Previous Job History</p>
              <p className="text-xs text-slate-400">{mapping.candidate_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {chain.map((prevMapping, idx) => (
            <React.Fragment key={prevMapping.id}>
              <JobHistoryCard
                prevMapping={prevMapping}
                movedToJobTitle={movedToList[idx]?.jobTitle}
                movedOn={movedToList[idx]?.movedOn}
                movedByName={movedToList[idx]?.movedByName}
              />
              {idx < chain.length - 1 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-dashed border-slate-200" />
                  <span className="text-[10px] text-slate-400 shrink-0">Earlier job</span>
                  <div className="flex-1 border-t border-dashed border-slate-200" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

      </div>
    </div>
  );
}
