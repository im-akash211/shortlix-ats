import React from 'react';
import { Share2, MessageCircle, Send, ChevronDown, ChevronUp, Bell } from 'lucide-react';
import {
  SCREENING_STATUS_COLORS, SCREENING_STATUS_LABELS,
  ROUND_LABELS, ROUND_PROGRESSION,
  OFFER_STATUS_LABELS, DROP_REASON_LABELS,
} from '../constants';

export default function CandidateCard({
  c,
  // share state/handlers
  shareOpen, setShareOpen, shareSearch, setShareSearch, shareSelected, setShareSelected, shareRef,
  usersList, usersLoading, handleShare,
  // reminder
  onSetReminder,
  // pipeline action handlers
  openCandidateProfile,
  handleShortlist, shortlistingId,
  handleScreeningStatus, screeningStatusLoadingId, getMoveToOptions,
  handleMoveToInterview,
  handleMakeOffer,
  handleMarkJoined,
  handleRestoreToShortlist, restoringId,
  setDropModalCandidate, setDropReason,
  handleNextRound, nextRoundLoading,
  handleRoundStatus, roundStatusLoadingId,
  setScheduleModalCandidate, setScheduleModalRound,
  // comments
  commentsByCard, commentsOpenId, commentsLoadingId, commentInput, setCommentInput,
  commentSubmittingId, handleToggleComments, handleAddComment, handlePriorityChange,
}) {
  const isActive = c.is_current_stage !== false;
  const macroStage = c.macro_stage;
  const isShareOpen = shareOpen === c.id;
  const filteredUsers = usersList.filter(u =>
    u.full_name.toLowerCase().includes(shareSearch.toLowerCase())
  );

  const interviewDate = macroStage === 'INTERVIEW' && c.latest_round?.scheduled_at
    ? new Date(c.latest_round.scheduled_at) : null;
  const isUpcoming = interviewDate && interviewDate > new Date();

  return (
    <div key={c.id}>
      {/* Card */}
      <div className={`border rounded-xl p-4 ${isActive ? 'bg-white hover:shadow-md transition-shadow border-slate-200' : 'bg-slate-50 opacity-50 border-slate-100'}`}>

        {/* TOP: avatar + name + sub-info + badges + share */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); isActive && openCandidateProfile(c); }}
              className="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 hover:bg-blue-50 hover:text-blue-600"
            >
              {c.candidate_name?.slice(0, 2).toUpperCase() || '?'}
            </button>
            <div className="min-w-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); isActive && openCandidateProfile(c); }}
                className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors text-left leading-tight block truncate max-w-[210px]"
              >
                {c.candidate_name}
              </button>
              <div className="flex items-center gap-2 mt-0.5">
                {c.candidate_experience != null && (
                  <span className="text-[11px] text-slate-400">{c.candidate_experience}yr exp</span>
                )}
                {c.candidate_location && (
                  <span className="text-[11px] text-slate-400 truncate max-w-[130px]">{c.candidate_location}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={c.priority || 'LOW'}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); handlePriorityChange && handlePriorityChange(c, e.target.value); }}
              className={`text-[9px] font-bold uppercase border px-2 py-0.5 rounded outline-none cursor-pointer appearance-none text-center ${
                c.priority === 'HIGH' ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' :
                c.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' :
                'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            {macroStage === 'APPLIED' && c.screening_status && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SCREENING_STATUS_COLORS[c.screening_status] || 'bg-slate-100 text-slate-600'}`}>
                {SCREENING_STATUS_LABELS[c.screening_status] || c.screening_status}
              </span>
            )}
            {macroStage === 'INTERVIEW' && c.current_interview_round && (() => {
              const lr = c.latest_round;
              const isCurrentRoundScheduled = lr && lr.round_name === c.current_interview_round;
              const displayRound = isCurrentRoundScheduled ? c.current_interview_round : (lr?.round_name || c.current_interview_round);
              const displayStatus = lr?.round_status;
              return (
                <div className="flex flex-col items-end">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.interview_status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-purple-100 text-purple-700'}`}>
                    {ROUND_LABELS[displayRound] || displayRound}
                    {c.interview_status === 'REJECTED' && ' - Rejected'}
                  </span>
                  {displayStatus && (
                    <span className={`text-[9px] mt-0.5 font-medium uppercase tracking-wider ${
                      displayStatus === 'COMPLETED' ? 'text-emerald-500' :
                      displayStatus === 'ON_HOLD' ? 'text-amber-500' :
                      'text-slate-400'
                    }`}>
                      {displayStatus.replace('_', ' ')}
                    </span>
                  )}
                </div>
              );
            })()}
            {macroStage === 'OFFERED' && c.offer_status && (
              <span className="text-[10px] font-semibold bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full">
                {OFFER_STATUS_LABELS[c.offer_status]}
              </span>
            )}
            {macroStage === 'DROPPED' && c.drop_reason && (
              <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                {DROP_REASON_LABELS[c.drop_reason]}
              </span>
            )}
            {isActive && (
              <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSetReminder && onSetReminder(c); }}
                className="text-slate-400 hover:text-amber-500 transition-colors p-1"
                title="Set Reminder"
              >
                <Bell className="w-3 h-3" />
              </button>
              <div className="relative" ref={isShareOpen ? shareRef : null}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShareOpen(isShareOpen ? null : c.id); setShareSearch(''); setShareSelected([]); }}
                  className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                  title="Share"
                >
                  <Share2 className="w-3 h-3" />
                </button>
                {isShareOpen && (
                  <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-[300] flex flex-col overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                      <input autoFocus type="text" placeholder="Search users..." value={shareSearch}
                        onChange={(e) => setShareSearch(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
                    </div>
                    <div className="overflow-y-auto max-h-48">
                      {usersLoading ? (
                        <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
                          <svg className="animate-spin w-4 h-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                          <span className="text-xs">Loading...</span>
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-3">No users found</p>
                      ) : filteredUsers.map((u) => (
                        <label key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                          <input type="checkbox" checked={shareSelected.includes(u.id)}
                            onChange={() => setShareSelected(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                            className="accent-blue-600" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-800 truncate">{u.full_name}</p>
                            <p className="text-[10px] text-slate-400 truncate capitalize">{u.role?.replace('_', ' ')}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="p-2 border-t border-slate-100">
                      <button disabled={shareSelected.length === 0}
                        onClick={() => handleShare(c.candidate)}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded-lg transition-colors">
                        Share{shareSelected.length > 0 ? ` (${shareSelected.length})` : ''}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        </div>

        {/* ROW 2: Skills */}
        {c.candidate_skills?.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-2.5">
            {c.candidate_skills.slice(0, 4).map((s, i) => (
              <span key={i} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{s}</span>
            ))}
          </div>
        )}

        {/* ROW 3: Metadata strip */}
        <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-3 flex-wrap">
          {interviewDate && (
            <span className={`flex items-center gap-1 ${isUpcoming ? 'text-purple-600 font-medium' : ''}`}>
              📅 {interviewDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              {c.latest_round?.round_status && ` - ${c.latest_round.round_status}`}
            </span>
          )}
          {c.stage_updated_at && (
            <span>Updated {new Date(c.stage_updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          )}
        </div>

        {/* ROW 4: Actions */}
        {isActive && (
          <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
            {macroStage === 'APPLIED' && (
              <>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleShortlist(c); }} disabled={shortlistingId === c.id}
                  className="text-xs font-semibold bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {shortlistingId === c.id ? '...' : 'Shortlist'}
                </button>
                <select value="" disabled={screeningStatusLoadingId === c.id}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); if (e.target.value) handleScreeningStatus(c, e.target.value); }}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none cursor-pointer disabled:opacity-50 min-w-[90px] transition-colors">
                  <option value="" disabled>Move to...</option>
                  {getMoveToOptions(c.screening_status).map(opt => (
                    <option key={opt} value={opt}>{SCREENING_STATUS_LABELS[opt]}</option>
                  ))}
                </select>
              </>
            )}
            {macroStage === 'SHORTLISTED' && (
              <button type="button" onClick={(e) => { e.stopPropagation(); handleMoveToInterview(c); }} disabled={shortlistingId === c.id}
                className="text-xs font-semibold bg-purple-600 text-white rounded-lg px-3 py-1.5 hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {shortlistingId === c.id ? '...' : 'Move to Interview'}
              </button>
            )}
            {macroStage === 'OFFERED' && (
              <button type="button" onClick={(e) => { e.stopPropagation(); handleMarkJoined(c); }} disabled={shortlistingId === c.id}
                className="text-xs font-semibold bg-emerald-600 text-white rounded-lg px-3 py-1.5 hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {shortlistingId === c.id ? '...' : 'Mark Joined'}
              </button>
            )}
            {macroStage === 'DROPPED' && (
              <button type="button" onClick={(e) => { e.stopPropagation(); handleRestoreToShortlist(c); }} disabled={restoringId === c.id}
                className="text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 transition-colors">
                {restoringId === c.id ? '...' : 'Restore to Pipeline'}
              </button>
            )}
            {macroStage === 'INTERVIEW' && (() => {
              const currentRound = c.current_interview_round || 'R1';
              const currentIndex = ROUND_PROGRESSION.indexOf(currentRound);
              const roundsToShow = ROUND_PROGRESSION.slice(0, Math.max(1, currentIndex + 1));

              return (
                <div className="flex items-center gap-1.5 text-[10px] font-medium flex-wrap">
                  {roundsToShow.map((r, idx) => {
                    const isPast = idx < currentIndex;
                    const isCurrent = idx === currentIndex;
                    const displayStatus = (isCurrent && c.latest_round && c.latest_round.round_name === r) ? c.latest_round.round_status : null;
                    const isCompleted = isPast || displayStatus === 'COMPLETED';
                    const badgeClasses = isCompleted
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : isCurrent
                        ? (displayStatus === 'ON_HOLD' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-purple-50 border-purple-200 text-purple-700')
                        : 'bg-slate-50 border-slate-200 text-slate-500';

                    return (
                      <React.Fragment key={r}>
                        <span className={`px-2 py-1 rounded border flex items-center gap-1 ${badgeClasses}`}>
                          {ROUND_LABELS[r] || r} {isCompleted && <span className="font-bold">✓</span>}
                        </span>
                        {idx < roundsToShow.length - 1 && <span className="text-slate-300">→</span>}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}
            {/* Right-aligned actions: Interview Flow & Drop */}
            <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
              {macroStage === 'INTERVIEW' && (() => {
                const currentRound = c.current_interview_round || 'R1';
                const lr = c.latest_round;
                const isCurrentRoundScheduled = lr && lr.round_name === currentRound;
                const roundStatus = isCurrentRoundScheduled ? lr.round_status : null;

                if (c.interview_status === 'REJECTED') {
                  return (
                    <div className="flex items-center gap-1.5">
                      <select defaultValue={currentRound}
                        id={`reschedule-round-${c.id}`}
                        className="text-[10px] border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700 outline-none">
                        {ROUND_PROGRESSION.map(r => <option key={r} value={r}>{ROUND_LABELS[r]}</option>)}
                      </select>
                      <button type="button" onClick={(e) => {
                        e.stopPropagation();
                        const sel = document.getElementById(`reschedule-round-${c.id}`);
                        setScheduleModalCandidate(c);
                        setScheduleModalRound(sel ? sel.value : currentRound);
                      }}
                        className="text-xs font-semibold bg-rose-600 text-white rounded-lg px-3 py-1.5 hover:bg-rose-700 transition-colors">
                        Reschedule
                      </button>
                    </div>
                  );
                }
                if (!isCurrentRoundScheduled) {
                  return (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setScheduleModalCandidate(c); setScheduleModalRound(currentRound); }}
                      className="text-xs font-semibold bg-purple-600 text-white rounded-lg px-3 py-1.5 hover:bg-purple-700 transition-colors">
                      Schedule {ROUND_LABELS[currentRound] || currentRound}
                    </button>
                  );
                }
                if (roundStatus === 'SCHEDULED') {
                  return (
                    <div className="flex items-center gap-2">
                      <button type="button" disabled={roundStatusLoadingId === c.id}
                        onClick={(e) => { e.stopPropagation(); handleRoundStatus(lr.id, 'COMPLETED', c.id); }}
                        className="text-xs font-semibold bg-green-600 text-white rounded-lg px-3 py-1.5 hover:bg-green-700 disabled:opacity-50 transition-colors">
                        Mark Completed
                      </button>
                      <button type="button" disabled={roundStatusLoadingId === c.id}
                        onClick={(e) => { e.stopPropagation(); handleRoundStatus(lr.id, 'ON_HOLD', c.id); }}
                        className="text-xs border border-slate-300 text-slate-600 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                        Hold
                      </button>
                    </div>
                  );
                }
                if (roundStatus === 'ON_HOLD') {
                  return (
                    <button type="button" disabled={roundStatusLoadingId === c.id}
                      onClick={(e) => { e.stopPropagation(); handleRoundStatus(lr.id, 'SCHEDULED', c.id); }}
                      className="text-xs font-semibold bg-amber-600 text-white rounded-lg px-3 py-1.5 hover:bg-amber-700 disabled:opacity-50 transition-colors">
                      Resume Round
                    </button>
                  );
                }
                if (roundStatus === 'COMPLETED') {
                  const isLastRound = ROUND_PROGRESSION.indexOf(currentRound) >= ROUND_PROGRESSION.length - 1;
                  return (
                    <div className="flex items-center gap-2">
                      {!isLastRound && (
                        <button type="button" disabled={nextRoundLoading === c.id} onClick={(e) => { e.stopPropagation(); handleNextRound(c); }}
                          className="text-xs font-semibold bg-purple-600 text-white rounded-lg px-3 py-1.5 hover:bg-purple-700 disabled:opacity-50 transition-colors">
                          {nextRoundLoading === c.id ? '...' : 'Move to Next Round'}
                        </button>
                      )}
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleMakeOffer(c); }} disabled={shortlistingId === c.id}
                        className="text-xs font-semibold bg-cyan-600 text-white rounded-lg px-3 py-1.5 hover:bg-cyan-700 disabled:opacity-40 transition-colors">
                        {shortlistingId === c.id ? '...' : 'Make Offer'}
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
              {/* Primary Termination Action (Reject/Drop) */}
              {!['JOINED', 'DROPPED'].includes(macroStage) && c.interview_status !== 'REJECTED' && (
                <button onClick={() => { setDropModalCandidate(c); setDropReason('REJECTED'); }}
                  className="text-xs text-rose-500 hover:text-rose-700 px-2.5 py-1.5 border border-rose-100 hover:border-rose-200 rounded-lg transition-colors">
                  {macroStage === 'INTERVIEW' ? 'Reject' : 'Drop'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Comments section */}
        <div className="mt-2 border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleComments(c); }}
            className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors ${commentsOpenId === c.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
          >
            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="font-medium">Comments</span>
              {commentsByCard[c.id]?.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[9px] font-bold leading-none flex items-center justify-center">
                  {commentsByCard[c.id].length}
                </span>
              )}
            </div>
            {commentsOpenId === c.id ? <ChevronUp className="w-3.5 h-3.5 text-blue-500" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          
          {commentsOpenId === c.id && (
            <div className="mt-2 px-1 pb-1 space-y-3">
              {commentsLoadingId === c.id ? (
                <div className="flex items-center gap-2 text-slate-400 text-[10px] px-1">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" className="opacity-75" /></svg>
                  Loading comments...
                </div>
              ) : (commentsByCard[c.id] || []).length === 0 ? (
                <p className="text-[11px] text-slate-400 italic text-center py-2">No comments yet.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin pr-1">
                  {(commentsByCard[c.id] || []).map(cm => (
                    <div key={cm.id} className="text-[11px] bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-slate-700">{cm.user_name}</span>
                        <span className="text-[9px] text-slate-400">{new Date(cm.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-[10.5px]">{cm.content}</p>
                    </div>
                  ))}
                </div>
              )}
              {isActive && (
                <div className="flex items-center gap-2 mt-2 bg-white border border-slate-200 rounded-lg p-1 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all shadow-sm">
                  <input
                    type="text"
                    value={commentsOpenId === c.id ? commentInput : ''}
                    onChange={e => setCommentInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddComment(c); }}
                    placeholder="Write a comment..."
                    className="flex-1 text-[11px] bg-transparent outline-none px-2 py-1 min-w-0 text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleAddComment(c); }}
                    disabled={commentSubmittingId === c.id || !commentInput?.trim()}
                    className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
