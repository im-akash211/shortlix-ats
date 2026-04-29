import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { jobsApi, candidatesApi, interviewsApi, usersApi } from '../services/jobsApi';
import { STAGE_TAB_MAP } from '../constants';

export function useJobPipeline({ viewingJob, isPipelinePanelOpen }) {
  const queryClient = useQueryClient();

  const [pipelineTab, setPipelineTab]         = useState('Applied');
  const [allCandidates, setAllCandidates]     = useState([]);
  const [allCandidatesLoading, setAllCandidatesLoading] = useState(false);
  const [dimmedCandidates, setDimmedCandidates] = useState([]);
  const [dimmedLoading, setDimmedLoading]     = useState(false);

  const [screeningFilter, setScreeningFilter] = useState('ALL');
  const [interviewFilter, setInterviewFilter] = useState('ALL');
  const [offeredFilter, setOfferedFilter] = useState('PENDING');

  const [scheduleModalCandidate, setScheduleModalCandidate] = useState(null);
  const [scheduleModalRound, setScheduleModalRound] = useState(null);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [roundStatusLoadingId, setRoundStatusLoadingId] = useState(null);

  const [shortlistingId, setShortlistingId] = useState(null);
  const [screeningStatusLoadingId, setScreeningStatusLoadingId] = useState(null);
  const [nextRoundLoading, setNextRoundLoading] = useState(null);
  const [jumpRoundLoading, setJumpRoundLoading] = useState(null);

  const [dropModalCandidate, setDropModalCandidate] = useState(null);
  const [dropReason, setDropReason]               = useState('REJECTED');
  const [dropLoading, setDropLoading]             = useState(false);

  const [restoringId, setRestoringId] = useState(null);

  const [commentsByCard, setCommentsByCard]           = useState({});
  const [commentsOpenId, setCommentsOpenId]            = useState(null);
  const [commentsLoadingId, setCommentsLoadingId]      = useState(null);
  const [commentInput, setCommentInput]                = useState('');
  const [commentSubmittingId, setCommentSubmittingId]  = useState(null);

  const [scheduleForm, setScheduleForm] = useState({
    round_number: 1, round_label: '', interviewer: '',
    scheduled_at: '', duration_minutes: 60, mode: 'virtual', meeting_link: '',
  });

  const refreshAllCandidates = (jobId) =>
    jobsApi.pipeline(jobId, {})
      .then((res) => setAllCandidates(Array.isArray(res) ? res : (res.results || [])))
      .catch(console.error);

  const refreshDimmed = (jobId, tab) => {
    if (tab === 'Offered') { setDimmedCandidates([]); return Promise.resolve(); }
    const stage = STAGE_TAB_MAP[tab];
    if (!stage) { setDimmedCandidates([]); return Promise.resolve(); }
    return jobsApi.pipeline(jobId, { stage, include_progressed: 'true' })
      .then((res) => {
        const all = Array.isArray(res) ? res : (res.results || []);
        setDimmedCandidates(all.filter(c => c.is_current_stage === false));
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (!viewingJob) { setAllCandidates([]); return; }
    setAllCandidatesLoading(true);
    refreshAllCandidates(viewingJob.id).finally(() => setAllCandidatesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingJob]);

  useEffect(() => {
    if (!viewingJob || !isPipelinePanelOpen) return;
    setDimmedLoading(true);
    refreshDimmed(viewingJob.id, pipelineTab).finally(() => setDimmedLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingJob, pipelineTab, isPipelinePanelOpen]);

  const getStatCount = (tab) => {
    if (tab === 'Applied')     return allCandidates.length;
    if (tab === 'Shortlisted') return allCandidates.filter(c => ['SHORTLISTED', 'INTERVIEW', 'OFFERED', 'JOINED'].includes(c.macro_stage)).length;
    if (tab === 'Interview')   return allCandidates.filter(c => ['INTERVIEW', 'OFFERED', 'JOINED'].includes(c.macro_stage)).length;
    if (tab === 'Offered')     return allCandidates.filter(c => ['OFFERED', 'JOINED'].includes(c.macro_stage)).length;
    if (tab === 'Joined')      return allCandidates.filter(c => c.macro_stage === 'JOINED').length;
    if (tab === 'Dropped')     return allCandidates.filter(c => c.macro_stage === 'DROPPED' && c.drop_reason !== 'REJECTED').length;
    return 0;
  };

  const doStageChange = async (c, payload) => {
    await candidatesApi.changeStage(c.candidate, c.job, payload);
    await Promise.all([
      refreshAllCandidates(viewingJob.id),
      refreshDimmed(viewingJob.id, pipelineTab),
    ]);
    queryClient.invalidateQueries({ queryKey: ['jobs', 'list'] });
  };

  const handleScreeningStatus = async (c, newStatus) => {
    setScreeningStatusLoadingId(c.id);
    try {
      await candidatesApi.setScreeningStatus(c.candidate, c.job, newStatus);
      setAllCandidates(prev =>
        prev.map(m => m.id === c.id ? { ...m, screening_status: newStatus } : m)
      );
    } catch (err) {
      alert(err.data?.detail || err.data?.error || 'Failed to update screening status');
    } finally {
      setScreeningStatusLoadingId(null);
    }
  };

  const getMoveToOptions = (currentScreeningStatus) => {
    const all = ['SCREENED', 'MAYBE', 'REJECTED'];
    return all.filter(s => s !== currentScreeningStatus);
  };

  const handleShortlist = async (c, reason = '') => {
    setShortlistingId(c.id);
    try {
      await doStageChange(c, { macro_stage: 'SHORTLISTED', action_reason: reason });
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to shortlist candidate');
    } finally {
      setShortlistingId(null);
    }
  };

  const handleMoveToInterview = async (c) => {
    setShortlistingId(c.id);
    try {
      await doStageChange(c, { macro_stage: 'INTERVIEW' });
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to move to interview');
    } finally {
      setShortlistingId(null);
    }
  };

  const handleMakeOffer = async (c) => {
    setShortlistingId(c.id);
    try {
      await doStageChange(c, { macro_stage: 'OFFERED', offer_status: 'OFFER_SENT' });
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to make offer');
    } finally {
      setShortlistingId(null);
    }
  };

  const handleMarkOfferAccepted = async (c) => {
    setShortlistingId(c.id);
    try {
      await candidatesApi.changeStage(c.candidate, c.job, { offer_status: 'OFFER_ACCEPTED' });
      await refreshAllCandidates(viewingJob.id);
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to mark offer as accepted');
    } finally {
      setShortlistingId(null);
    }
  };

  const handleMarkJoined = async (c) => {
    setShortlistingId(c.id);
    try {
      await doStageChange(c, { macro_stage: 'JOINED' });
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to mark as joined');
    } finally {
      setShortlistingId(null);
    }
  };

  const handleDropConfirm = async () => {
    if (!dropModalCandidate) return;
    setDropLoading(true);
    try {
      await doStageChange(dropModalCandidate, { macro_stage: 'DROPPED', drop_reason: dropReason });
      setDropModalCandidate(null);
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to drop candidate');
    } finally {
      setDropLoading(false);
    }
  };

  const handleNextRound = async (c) => {
    setNextRoundLoading(c.id);
    try {
      await candidatesApi.nextRound(c.candidate, c.job);
      await refreshAllCandidates(viewingJob.id);
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to advance round');
    } finally {
      setNextRoundLoading(null);
    }
  };

  const handleJumpRound = async (c, roundName) => {
    setJumpRoundLoading(c.id);
    try {
      await candidatesApi.jumpToRound(c.candidate, c.job, roundName);
      await refreshAllCandidates(viewingJob.id);
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to jump round');
    } finally {
      setJumpRoundLoading(null);
    }
  };

  const handleNewScheduleSubmit = async () => {
    if (!scheduleForm.scheduled_at) {
      alert('Date and time are required');
      return;
    }
    if (!scheduleForm.interviewer) {
      alert('Interviewer is required');
      return;
    }
    setScheduleSubmitting(true);
    try {
      await interviewsApi.create({
        mapping: scheduleModalCandidate.id,
        round_name: scheduleModalRound,
        round_status: 'SCHEDULED',
        scheduled_at: new Date(scheduleForm.scheduled_at).toISOString(),
        mode: scheduleForm.mode,
        meeting_link: scheduleForm.meeting_link || '',
        interviewer: scheduleForm.interviewer,
        duration_minutes: Number(scheduleForm.duration_minutes),
      });
      await refreshAllCandidates(viewingJob.id);
      setScheduleModalCandidate(null);
      setScheduleModalRound(null);
      setScheduleForm({ round_number: 1, round_label: '', interviewer: '', scheduled_at: '', duration_minutes: 60, mode: 'virtual', meeting_link: '' });
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to schedule interview');
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const handleRoundStatus = async (interviewId, newStatus, candidateId) => {
    setRoundStatusLoadingId(candidateId);
    try {
      await interviewsApi.setRoundStatus(interviewId, newStatus);
      await refreshAllCandidates(viewingJob.id);
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to update round status');
    } finally {
      setRoundStatusLoadingId(null);
    }
  };

  const handleRejectRound = async (c) => {
    if (!window.confirm(`Reject ${c.candidate_name} from this interview round?`)) return;
    setRoundStatusLoadingId(c.id);
    try {
      await interviewsApi.setRoundResult(c.latest_round.id, 'FAIL');
      await refreshAllCandidates(viewingJob.id);
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to reject round');
    } finally {
      setRoundStatusLoadingId(null);
    }
  };

  const handleAppliedReject = async (c, reason = '') => {
    setShortlistingId(c.id);
    try {
      await doStageChange(c, { macro_stage: 'DROPPED', drop_reason: 'REJECTED', action_reason: reason });
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to reject candidate');
    } finally {
      setShortlistingId(null);
    }
  };

  const handleInterviewReject = async (c) => {
    setRoundStatusLoadingId(c.id);
    try {
      if (c.latest_round?.id) {
        await interviewsApi.setRoundResult(c.latest_round.id, 'FAIL');
      } else {
        await candidatesApi.changeStage(c.candidate, c.job, { interview_status: 'REJECTED' });
      }
      await refreshAllCandidates(viewingJob.id);
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to reject candidate');
    } finally {
      setRoundStatusLoadingId(null);
    }
  };

  const handleClearInterviewReject = async (c) => {
    setRoundStatusLoadingId(c.id);
    try {
      await candidatesApi.changeStage(c.candidate, c.job, { interview_status: null });
      await refreshAllCandidates(viewingJob.id);
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to restore candidate');
    } finally {
      setRoundStatusLoadingId(null);
    }
  };

  const handleRestoreToShortlist = async (c) => {
    setRestoringId(c.id);
    try {
      await candidatesApi.changeStage(c.candidate, c.job, {
        macro_stage: 'SHORTLISTED',
        remarks: 'Restored from Dropped',
      });
      await refreshAllCandidates(viewingJob.id);
    } catch (err) {
      alert(err.data?.error || 'Failed to restore candidate');
    } finally {
      setRestoringId(null);
    }
  };

  const handleToggleComments = async (c) => {
    if (commentsOpenId === c.id) {
      setCommentsOpenId(null);
      return;
    }
    setCommentsOpenId(c.id);
    setCommentInput('');
    if (commentsByCard[c.id] !== undefined) return;

    setCommentsLoadingId(c.id);
    try {
      const data = await candidatesApi.getComments(c.candidate, c.job);
      const commentsArray = Array.isArray(data) ? data : (data?.results || []);
      setCommentsByCard(prev => ({ ...prev, [c.id]: commentsArray }));
    } catch {
      setCommentsByCard(prev => ({ ...prev, [c.id]: [] }));
    } finally {
      setCommentsLoadingId(null);
    }
  };

  const handleAddComment = async (c) => {
    const text = commentInput.trim();
    if (!text) return;
    setCommentSubmittingId(c.id);
    try {
      const newComment = await candidatesApi.addComment(c.candidate, c.job, text);
      setCommentsByCard(prev => ({ ...prev, [c.id]: [...(prev[c.id] || []), newComment] }));
      setCommentInput('');
    } catch {
      alert('Failed to add comment');
    } finally {
      setCommentSubmittingId(null);
    }
  };
  const handlePriorityChange = async (c, newPriority) => {
    try {
      await candidatesApi.changeStage(c.candidate, c.job, { priority: newPriority });
      setAllCandidates((prev) =>
        prev.map((m) => (m.id === c.id ? { ...m, priority: newPriority } : m))
      );
      setDimmedCandidates((prev) =>
        prev.map((m) => (m.id === c.id ? { ...m, priority: newPriority } : m))
      );
    } catch (err) {
      alert(err.data?.detail || err.data?.error || 'Failed to update priority');
    }
  };

  return {
    pipelineTab, setPipelineTab,
    allCandidates,
    allCandidatesLoading,
    dimmedCandidates,
    dimmedLoading, setDimmedLoading,
    screeningFilter, setScreeningFilter,
    interviewFilter, setInterviewFilter,
    offeredFilter, setOfferedFilter,
    scheduleModalCandidate, setScheduleModalCandidate,
    scheduleModalRound, setScheduleModalRound,
    scheduleSubmitting,
    roundStatusLoadingId,
    shortlistingId,
    screeningStatusLoadingId,
    nextRoundLoading,
    jumpRoundLoading,
    dropModalCandidate, setDropModalCandidate,
    dropReason, setDropReason,
    dropLoading,
    restoringId,
    commentsByCard,
    commentsOpenId,
    commentsLoadingId,
    commentInput, setCommentInput,
    commentSubmittingId,
    scheduleForm, setScheduleForm,
    refreshAllCandidates,
    refreshDimmed,
    getStatCount,
    getMoveToOptions,
    handleScreeningStatus,
    handleShortlist,
    handleAppliedReject,
    handleMoveToInterview,
    handleMakeOffer,
    handleMarkOfferAccepted,
    handleMarkJoined,
    handleDropConfirm,
    handleNextRound,
    handleJumpRound,
    handleNewScheduleSubmit,
    handleRoundStatus,
    handleRejectRound,
    handleInterviewReject,
    handleClearInterviewReject,
    handleRestoreToShortlist,
    handleToggleComments,
    handleAddComment,
    handlePriorityChange,
  };
}
