import React from 'react';
import { X, Briefcase, ArrowRight } from 'lucide-react';

const STAGE_LABELS = {
  APPLIED:     'Applied',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW:   'Interview',
  OFFERED:     'Offered',
  JOINED:      'Joined',
  DROPPED:     'Dropped',
};

const DROP_REASON_LABELS = {
  REJECTED:      'Rejected by recruiter',
  CANDIDATE_DROP:'Dropped by candidate',
  NO_SHOW:       'No show',
};

const STAGE_COLORS = {
  APPLIED:     'bg-slate-100 text-slate-600 border-slate-200',
  SHORTLISTED: 'bg-blue-50 text-blue-700 border-blue-200',
  INTERVIEW:   'bg-purple-50 text-purple-700 border-purple-200',
  OFFERED:     'bg-cyan-50 text-cyan-700 border-cyan-200',
  JOINED:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  DROPPED:     'bg-rose-50 text-rose-700 border-rose-200',
};

function StageChip({ stage }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STAGE_COLORS[stage] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
      {STAGE_LABELS[stage] || stage}
    </span>
  );
}

export default function PreviousJobHistoryModal({ mapping, onClose }) {
  if (!mapping) return null;
  const prev = mapping.previous_mapping;
  if (!prev) return null;

  // Collect the full chain: current mapping + all previous ones
  const chain = [];
  let cursor = mapping;
  while (cursor.previous_mapping) {
    chain.push(cursor.previous_mapping);
    cursor = cursor.previous_mapping;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[600] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4 text-violet-600" />
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
          {chain.map((prevMapping, chainIdx) => (
            <div key={prevMapping.id} className="flex flex-col gap-3">

              {/* Job header */}
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {prevMapping.job_code} — {prevMapping.job_title}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {prevMapping.created_at
                      ? new Date(prevMapping.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : ''}
                    {prevMapping.archived_at && (
                      <> → {new Date(prevMapping.archived_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StageChip stage={prevMapping.macro_stage} />
                  {prevMapping.macro_stage === 'DROPPED' && prevMapping.drop_reason && (
                    <span className="text-[10px] text-rose-500 font-medium">
                      ({DROP_REASON_LABELS[prevMapping.drop_reason] || prevMapping.drop_reason})
                    </span>
                  )}
                  {prevMapping.interview_status === 'REJECTED' && (
                    <span className="text-[10px] text-rose-500 font-medium">(Interview rejected)</span>
                  )}
                </div>
              </div>

              {/* Stage timeline */}
              {prevMapping.stage_logs?.length > 0 ? (
                <div className="flex flex-col pl-3">
                  {prevMapping.stage_logs.map((log, idx) => {
                    const isLast = idx === prevMapping.stage_logs.length - 1;
                    return (
                      <div key={log.id} className="flex gap-3 relative pb-3 last:pb-0">
                        {/* Vertical connector line */}
                        {!isLast && (
                          <div className="absolute left-[5px] top-3 bottom-0 w-px bg-slate-200" />
                        )}
                        {/* Dot */}
                        <div className={`w-3 h-3 rounded-full shrink-0 mt-0.5 z-10 border-2 ${
                          log.to_macro_stage === 'DROPPED'
                            ? 'bg-rose-400 border-rose-200'
                            : log.to_macro_stage === 'JOINED'
                              ? 'bg-emerald-400 border-emerald-200'
                              : log.to_macro_stage === 'OFFERED'
                                ? 'bg-cyan-400 border-cyan-200'
                                : log.to_macro_stage === 'INTERVIEW'
                                  ? 'bg-purple-400 border-purple-200'
                                  : log.to_macro_stage === 'SHORTLISTED'
                                    ? 'bg-blue-400 border-blue-200'
                                    : 'bg-slate-300 border-slate-100'
                        }`} />
                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {log.from_macro_stage ? (
                              <>
                                <StageChip stage={log.from_macro_stage} />
                                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                <StageChip stage={log.to_macro_stage} />
                              </>
                            ) : (
                              <StageChip stage={log.to_macro_stage} />
                            )}
                          </div>
                          {log.remarks && (
                            <p className="text-[10px] text-slate-500 mt-0.5 italic">{log.remarks}</p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {log.moved_by_name && <span className="font-medium text-slate-500">{log.moved_by_name} · </span>}
                            {new Date(log.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 pl-3 italic">No stage transition records found.</p>
              )}

              {/* Separator between chain items */}
              {chainIdx < chain.length - 1 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 border-t border-dashed border-slate-200" />
                  <span className="text-[10px] text-slate-400 shrink-0">Earlier</span>
                  <div className="flex-1 border-t border-dashed border-slate-200" />
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
