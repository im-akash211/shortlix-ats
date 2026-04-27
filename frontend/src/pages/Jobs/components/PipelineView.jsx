import React from 'react';
import { Users } from 'lucide-react';
import { PageLoader } from '../../../components/LoadingDots';
import { STAGE_TAB_MAP, PIPELINE_TABS } from '../constants';
import CandidateCard from './CandidateCard';

export default function PipelineView({
  pipelineTab,
  allCandidates,
  allCandidatesLoading,
  dimmedCandidates,
  dimmedLoading,
  screeningFilter, setScreeningFilter,
  interviewFilter, setInterviewFilter,
  offeredFilter, setOfferedFilter,
  onTabChange,
  getStatCount,
  // pass-through to CandidateCard
  shareOpen, setShareOpen, shareSearch, setShareSearch, shareSelected, setShareSelected, shareRef,
  usersList, usersLoading, handleShare,
  openCandidateProfile,
  handleShortlist, handleAppliedReject, shortlistingId,
  handleScreeningStatus, screeningStatusLoadingId, getMoveToOptions,
  handleMoveToInterview,
  handleMakeOffer,
  handleMarkJoined,
  handleRestoreToShortlist, restoringId,
  handleInterviewReject,
  handleClearInterviewReject,
  setDropModalCandidate, setDropReason,
  handleNextRound, nextRoundLoading,
  handleJumpRound, jumpRoundLoading,
  handleRoundStatus, roundStatusLoadingId,
  setScheduleModalCandidate, setScheduleModalRound,
  commentsByCard, commentsOpenId, commentsLoadingId, commentInput, setCommentInput,
  commentSubmittingId, handleToggleComments, handleAddComment, handlePriorityChange,
  onSetReminder,
  onViewDetails,
}) {
  const cardProps = {
    shareOpen, setShareOpen, shareSearch, setShareSearch, shareSelected, setShareSelected, shareRef,
    usersList, usersLoading, handleShare,
    onSetReminder,
    onViewDetails,
    openCandidateProfile,
    handleShortlist, handleAppliedReject, shortlistingId,
    handleScreeningStatus, screeningStatusLoadingId, getMoveToOptions,
    handleMoveToInterview,
    handleMakeOffer,
    handleMarkJoined,
    handleRestoreToShortlist, restoringId,
    handleInterviewReject,
    handleClearInterviewReject,
    setDropModalCandidate, setDropReason,
    handleNextRound, nextRoundLoading,
    handleJumpRound, jumpRoundLoading,
    handleRoundStatus, roundStatusLoadingId,
    setScheduleModalCandidate, setScheduleModalRound,
    commentsByCard, commentsOpenId, commentsLoadingId, commentInput, setCommentInput,
    commentSubmittingId, handleToggleComments, handleAddComment, handlePriorityChange,
  };

  return (
    <>
      {/* Stage tabs */}
      <div className="flex border-b border-slate-200 shrink-0 overflow-x-auto">
        {PIPELINE_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 min-w-[80px] py-3 text-sm font-medium border-b-2 transition-colors text-center ${
              pipelineTab === tab
                ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-base font-bold">{getStatCount(tab)}</span>
              <span className="text-[10px] uppercase tracking-wider">{tab}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Screening filter bar — only shown on Applied tab */}
      {pipelineTab === 'Applied' && (
        <div className="px-4 py-2 border-b border-slate-100 shrink-0 flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Filter:</span>
          <select
            value={screeningFilter}
            onChange={(e) => setScreeningFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="ALL">All</option>
            <option value="SCREENED">Screened</option>
            <option value="MAYBE">Maybe</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      )}
      {pipelineTab === 'Interview' && (
        <div className="px-4 py-2 border-b border-slate-100 shrink-0 flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Filter:</span>
          <select
            value={interviewFilter}
            onChange={(e) => setInterviewFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            <option value="ALL">All</option>
            <option value="R1">R1</option>
            <option value="R2">R2</option>
            <option value="R3">R3</option>
            <option value="CLIENT">Client</option>
            <option value="CDO">CDO</option>
            <option value="MGMT">MGMT</option>
            <option value="ON_HOLD">On Hold</option>
          </select>
        </div>
      )}
      {pipelineTab === 'Offered' && (() => {
        const pendingCount = allCandidates.filter(c => c.macro_stage === 'OFFERED').length;
        const joinedCount  = allCandidates.filter(c => c.macro_stage === 'JOINED').length;
        const droppedCount = allCandidates.filter(c => c.macro_stage === 'DROPPED').length;
        return (
          <div className="px-4 py-2.5 border-b border-slate-100 shrink-0 flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setOfferedFilter('PENDING')}
              className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors whitespace-nowrap flex items-center gap-1.5 ${offeredFilter === 'PENDING' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              Acceptance Pending
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${offeredFilter === 'PENDING' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>{pendingCount}</span>
            </button>
            <button
              onClick={() => setOfferedFilter('JOINED')}
              className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors whitespace-nowrap flex items-center gap-1.5 ${offeredFilter === 'JOINED' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              Joined
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${offeredFilter === 'JOINED' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>{joinedCount}</span>
            </button>
            <button
              onClick={() => setOfferedFilter('DROPPED')}
              className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors whitespace-nowrap flex items-center gap-1.5 ${offeredFilter === 'DROPPED' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              Dropped
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${offeredFilter === 'DROPPED' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>{droppedCount}</span>
            </button>
          </div>
        );
      })()}

      {/* Candidate list */}
      <div className="flex-1 overflow-y-auto p-4">
        {allCandidatesLoading ? (
          <PageLoader label="Loading candidates…" />
        ) : pipelineTab === 'Offered' ? (
          /* Offered tab: Filtered by sub-tab */
          (() => {
            let filtered = [];
            if (offeredFilter === 'PENDING') filtered = allCandidates.filter(c => c.macro_stage === 'OFFERED');
            else if (offeredFilter === 'JOINED') filtered = allCandidates.filter(c => c.macro_stage === 'JOINED');
            else if (offeredFilter === 'DROPPED') filtered = allCandidates.filter(c => c.macro_stage === 'DROPPED');

            if (filtered.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Users className="w-10 h-10 mb-2" />
                  <p className="text-sm">No candidates found in this section</p>
                </div>
              );
            }
            return (
              <div className="flex flex-col gap-4 pb-4">
                {filtered.map(c => <CandidateCard key={c.id} c={c} {...cardProps} />)}
              </div>
            );
          })()
        ) : (
          /* Applied / Shortlisted / Interview tabs */
          (() => {
            const currentStage = STAGE_TAB_MAP[pipelineTab];
            const stagePool = allCandidates.filter(c => c.macro_stage === currentStage);

            // Interview tab: split active vs rejected into dedicated sections
            const isInterview = pipelineTab === 'Interview';
            const rejectedCandidates = isInterview
              ? stagePool.filter(c => c.interview_status === 'REJECTED')
              : [];

            const activeCandidates = stagePool
              .filter(c => !isInterview || c.interview_status !== 'REJECTED')
              .filter(c =>
                pipelineTab !== 'Applied' || screeningFilter === 'ALL' || c.screening_status === screeningFilter
              )
              .filter(c => {
                if (!isInterview || interviewFilter === 'ALL') return true;
                if (interviewFilter === 'ON_HOLD') return c.latest_round?.round_status === 'ON_HOLD';
                return c.current_interview_round === interviewFilter;
              });

            const isEmpty = activeCandidates.length === 0 && rejectedCandidates.length === 0
              && dimmedCandidates.length === 0 && !dimmedLoading;

            if (isEmpty) {
              return (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Users className="w-10 h-10 mb-2" />
                  <p className="text-sm">No candidates in this stage</p>
                </div>
              );
            }
            return (
              <div className="flex flex-col gap-3">
                {activeCandidates.map(c => <CandidateCard key={c.id} c={c} {...cardProps} />)}

                {/* ── Rejected section (Interview tab only) ─────────────────── */}
                {isInterview && rejectedCandidates.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 py-2 mt-1">
                      <div className="flex-1 border-t border-dashed border-rose-200" />
                      <span className="text-xs font-semibold text-rose-400 shrink-0 flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-rose-400" />
                        Rejected ({rejectedCandidates.length})
                      </span>
                      <div className="flex-1 border-t border-dashed border-rose-200" />
                    </div>
                    {rejectedCandidates.map(c => <CandidateCard key={c.id} c={c} {...cardProps} />)}
                  </>
                )}

                {/* ── Progressed / dimmed section ───────────────────────────── */}
                {dimmedLoading ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-slate-400 text-xs border-t border-dashed border-slate-200 mt-1">
                    <svg className="animate-spin w-3.5 h-3.5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    Loading history…
                  </div>
                ) : dimmedCandidates.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 py-2 my-1">
                      <div className="flex-1 border-t border-dashed border-slate-200" />
                      <span className="text-xs text-slate-400 shrink-0">
                        {dimmedCandidates.length} candidate{dimmedCandidates.length !== 1 ? 's' : ''} progressed from this stage
                      </span>
                      <div className="flex-1 border-t border-dashed border-slate-200" />
                    </div>
                    {dimmedCandidates.map(c => <CandidateCard key={c.id} c={c} {...cardProps} />)}
                  </>
                ) : null}
              </div>
            );
          })()
        )}
      </div>
    </>
  );
}
