import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserPlus, Upload, Users, ChevronDown } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { ROUTES } from '../../routes/constants';
import { PageLoader } from '../../components/LoadingDots';
import StatusBadge from './components/StatusBadge';

import { jobsApi, candidatesApi, interviewsApi } from './services/jobsApi';
import { candidates as candidatesLibApi } from '../../lib/api';

import { useJobPipeline } from './hooks/useJobPipeline';
import { useShare } from './hooks/useShare';
import { useResumeUpload } from '../Candidates/hooks/useResumeUpload';

import PipelineView from './components/PipelineView';
import DropModal from './components/DropModal';
import NewScheduleModal from './components/NewScheduleModal';
import ApplyCandidateModal from './components/ApplyCandidateModal';
import SetReminderModal from './components/SetReminderModal';
import ResumeModal from './components/ResumeModal';
import UploadResumeModal from '../Candidates/components/UploadResumeModal';
import ReviewResumeModal from '../Candidates/components/ReviewResumeModal';

const URL_TO_TAB = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offered: 'Offered',
};

const TAB_TO_URL = {
  Applied: 'applied',
  Shortlisted: 'shortlisted',
  Interview: 'interview',
  Offered: 'offered',
};

export default function JobPipelinePage() {
  const { jobId, stage } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canUploadResume = user?.role === 'admin' || user?.role === 'recruiter';

  const initialTab = URL_TO_TAB[stage] || 'Applied';

  const [job, setJob] = useState(null);
  const [jobLoading, setJobLoading] = useState(true);

  useEffect(() => {
    setJobLoading(true);
    jobsApi.detail(jobId)
      .then(setJob)
      .catch(console.error)
      .finally(() => setJobLoading(false));
  }, [jobId]);

  const pipeline = useJobPipeline({ viewingJob: job, isPipelinePanelOpen: true });

  // Sync tab when URL stage param changes
  useEffect(() => {
    const tab = URL_TO_TAB[stage] || 'Applied';
    pipeline.setPipelineTab(tab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const handleTabChange = (tab) => {
    pipeline.setPipelineTab(tab);
    pipeline.setScreeningFilter('ALL');
    pipeline.setInterviewFilter('ALL');
    navigate(ROUTES.JOBS.PIPELINE(jobId, TAB_TO_URL[tab]), { replace: true });
  };

  const openCandidateProfile = (c) => {
    navigate(ROUTES.CANDIDATES.PROFILE_FROM_JOB(c.candidate, jobId));
  };

  // ── Share ───────────────────────────────────────────────────────────────────
  const share = useShare();

  useEffect(() => {
    if (!pipeline.scheduleModalCandidate) return;
    share.ensureUsersLoaded();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.scheduleModalCandidate]);

  // ── Reminder ────────────────────────────────────────────────────────────────
  const [reminderCandidate, setReminderCandidate] = useState(null);

  // ── Resume modal ─────────────────────────────────────────────────────────────
  const [resumeModal, setResumeModal] = useState(null);

  // ── Add candidate dropdown ───────────────────────────────────────────────────
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const addDropdownRef = React.useRef(null);
  useEffect(() => {
    if (!addDropdownOpen) return;
    const handler = (e) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target))
        setAddDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addDropdownOpen]);

  // ── Upload resume ────────────────────────────────────────────────────────────
  const [jobResumeActiveModal, setJobResumeActiveModal] = useState(null);
  const jobResume = useResumeUpload({ setActiveModal: setJobResumeActiveModal });
  const [assignConflict, setAssignConflict] = useState(null); // { candidate, currentJob }

  useEffect(() => {
    if (!jobResume.convertSuccess || !job) return;
    candidatesLibApi.assignJob(jobResume.convertSuccess.id, job.id)
      .then(() => {
        pipeline.setPipelineTab('Applied');
        pipeline.refreshAllCandidates(job.id);
      })
      .catch((err) => {
        if (err.status === 409 && err.data?.conflict) {
          setAssignConflict({ candidate: jobResume.convertSuccess, currentJob: err.data.current_job });
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobResume.convertSuccess]);

  const handleAssignConflictMove = async () => {
    if (!assignConflict || !job) return;
    try {
      await candidatesLibApi.moveJob(assignConflict.candidate.id, assignConflict.currentJob.id, job.id);
      setAssignConflict(null);
      pipeline.setPipelineTab('Applied');
      pipeline.refreshAllCandidates(job.id);
    } catch {
      setAssignConflict(null);
    }
  };

  const handleResumeApplyToJob = () => {
    pipeline.setPipelineTab('Applied');
    pipeline.refreshAllCandidates(job.id);
    handleTabChange('Applied');
  };

  // ── Apply from talent pool ───────────────────────────────────────────────────
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyToast, setApplyToast] = useState('');

  const handleApplyCandidateSuccess = (candidate) => {
    pipeline.setPipelineTab('Applied');
    pipeline.refreshAllCandidates(job.id);
    setApplyToast(`${candidate.full_name} applied to ${job.title} successfully.`);
    setTimeout(() => setApplyToast(''), 4000);
  };

  const pipelineCardProps = {
    shareOpen: share.shareOpen, setShareOpen: share.setShareOpen,
    shareSearch: share.shareSearch, setShareSearch: share.setShareSearch,
    shareSelected: share.shareSelected, setShareSelected: share.setShareSelected,
    shareRef: share.shareRef,
    usersList: share.usersList, usersLoading: share.usersLoading,
    handleShare: share.handleShare,
    openCandidateProfile,
    handleShortlist: pipeline.handleShortlist,
    handleAppliedReject: pipeline.handleAppliedReject,
    shortlistingId: pipeline.shortlistingId,
    handleScreeningStatus: pipeline.handleScreeningStatus,
    screeningStatusLoadingId: pipeline.screeningStatusLoadingId,
    getMoveToOptions: pipeline.getMoveToOptions,
    handleMoveToInterview: pipeline.handleMoveToInterview,
    handleMakeOffer: pipeline.handleMakeOffer,
    handleMarkOfferAccepted: pipeline.handleMarkOfferAccepted,
    handleMarkJoined: pipeline.handleMarkJoined,
    handleRestoreToShortlist: pipeline.handleRestoreToShortlist, restoringId: pipeline.restoringId,
    handleInterviewReject: pipeline.handleInterviewReject,
    handleClearInterviewReject: pipeline.handleClearInterviewReject,
    setDropModalCandidate: pipeline.setDropModalCandidate,
    setDropReason: pipeline.setDropReason,
    handleNextRound: pipeline.handleNextRound, nextRoundLoading: pipeline.nextRoundLoading,
    handleJumpRound: pipeline.handleJumpRound, jumpRoundLoading: pipeline.jumpRoundLoading,
    handleRoundStatus: pipeline.handleRoundStatus, roundStatusLoadingId: pipeline.roundStatusLoadingId,
    setScheduleModalCandidate: pipeline.setScheduleModalCandidate,
    setScheduleModalRound: pipeline.setScheduleModalRound,
    commentsByCard: pipeline.commentsByCard,
    commentsOpenId: pipeline.commentsOpenId,
    commentsLoadingId: pipeline.commentsLoadingId,
    commentInput: pipeline.commentInput,
    setCommentInput: pipeline.setCommentInput,
    commentSubmittingId: pipeline.commentSubmittingId,
    handleToggleComments: pipeline.handleToggleComments,
    handleAddComment: pipeline.handleAddComment,
    handlePriorityChange: pipeline.handlePriorityChange,
  };

  if (jobLoading) return <PageLoader label="Loading pipeline…" />;

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(ROUTES.JOBS.DETAIL(jobId))}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="w-px h-5 bg-slate-200 shrink-0" />
          <div className="min-w-0">
            {job?.job_code && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mr-2 ${job.job_code.startsWith('SHT-CLT') ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                {job.job_code}
              </span>
            )}
            <span className="text-sm font-bold text-slate-800 truncate">{job?.title}</span>
            {job?.status && <StatusBadge status={job.status} className="ml-2" />}
          </div>
        </div>

        {/* Add Candidate dropdown */}
        <div className="relative shrink-0" ref={addDropdownRef}>
          <button
            onClick={() => setAddDropdownOpen(o => !o)}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Candidate
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </button>
          {addDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-[400] overflow-hidden">
              {canUploadResume && (
                <button
                  onClick={() => { setAddDropdownOpen(false); jobResume.openUploadModal(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left"
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="font-medium">Upload Resume</p>
                    <p className="text-xs text-slate-400">Parse & add new candidate</p>
                  </div>
                </button>
              )}
              <button
                onClick={() => { setAddDropdownOpen(false); setApplyModalOpen(true); }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left border-t border-slate-100"
              >
                <Users className="w-4 h-4 shrink-0" />
                <div>
                  <p className="font-medium">From Talent Pool</p>
                  <p className="text-xs text-slate-400">Apply existing candidate</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Pipeline content (full width) ─────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <PipelineView
          pipelineTab={pipeline.pipelineTab}
          allCandidates={pipeline.allCandidates}
          allCandidatesLoading={pipeline.allCandidatesLoading}
          dimmedCandidates={pipeline.dimmedCandidates}
          dimmedLoading={pipeline.dimmedLoading}
          screeningFilter={pipeline.screeningFilter} setScreeningFilter={pipeline.setScreeningFilter}
          interviewFilter={pipeline.interviewFilter} setInterviewFilter={pipeline.setInterviewFilter}
          offeredFilter={pipeline.offeredFilter} setOfferedFilter={pipeline.setOfferedFilter}
          onTabChange={handleTabChange}
          getStatCount={pipeline.getStatCount}
          onSetReminder={setReminderCandidate}
          onViewDetails={openCandidateProfile}
          {...pipelineCardProps}
        />
      </div>

      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      {applyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-sm px-5 py-2.5 rounded-xl shadow-xl z-[500]">
          {applyToast}
        </div>
      )}

      {/* ── Assign conflict dialog ──────────────────────────────────────────── */}
      {assignConflict && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[600] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <p className="text-sm font-semibold text-slate-800">Candidate Already Applied</p>
            <p className="text-sm text-slate-600">
              <span className="font-medium">{assignConflict.candidate.full_name}</span> is currently applied to{' '}
              <span className="font-medium">{assignConflict.currentJob.job_code} — {assignConflict.currentJob.title}</span>.
              Move them to <span className="font-medium">{job?.job_code} — {job?.title}</span>?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setAssignConflict(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignConflictMove}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Move Here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <ResumeModal resumeModal={resumeModal} setResumeModal={setResumeModal} />

      <UploadResumeModal
        isOpen={jobResumeActiveModal === 'upload'}
        onClose={jobResume.closeUploadModal}
        uploadFile={jobResume.uploadFile}
        uploadLoading={jobResume.uploadLoading}
        uploadResult={jobResume.uploadResult}
        uploadError={jobResume.uploadError}
        uploadDuplicate={jobResume.uploadDuplicate}
        existingCandidate={jobResume.existingCandidate}
        fileInputRef={jobResume.fileInputRef}
        handleFileSelect={jobResume.handleFileSelect}
        handleUploadSubmit={jobResume.handleUploadSubmit}
        openReviewModal={jobResume.openReviewModal}
        setUploadResult={jobResume.setUploadResult}
        setUploadFile={jobResume.setUploadFile}
        setUploadError={jobResume.setUploadError}
        targetJob={job}
        onApplyExisting={(candidate) => {
          jobResume.closeUploadModal();
          candidatesLibApi.assignJob(candidate.id, job.id)
            .then(() => {
              pipeline.setPipelineTab('Applied');
              pipeline.refreshAllCandidates(job.id);
            })
            .catch((err) => {
              if (err.status === 409 && err.data?.conflict) {
                setAssignConflict({ candidate, currentJob: err.data.current_job });
              }
            });
        }}
      />
      <ReviewResumeModal
        isOpen={jobResumeActiveModal === 'review'}
        onClose={jobResume.closeReviewModal}
        reviewIngestion={jobResume.reviewIngestion}
        reviewForm={jobResume.reviewForm}
        reviewLoading={jobResume.reviewLoading}
        reviewSaved={jobResume.reviewSaved}
        convertLoading={jobResume.convertLoading}
        duplicateInfo={jobResume.duplicateInfo}
        resolveLoading={jobResume.resolveLoading}
        convertSuccess={jobResume.convertSuccess}
        reviewError={jobResume.reviewError}
        setReviewField={jobResume.setReviewField}
        updateEducation={jobResume.updateEducation}
        addEducation={jobResume.addEducation}
        removeEducation={jobResume.removeEducation}
        handleSaveReview={jobResume.handleSaveReview}
        handleConvert={jobResume.handleConvert}
        handleResolveDuplicate={jobResume.handleResolveDuplicate}
        queryClient={queryClient}
        targetJob={job}
        onApplyToJob={handleResumeApplyToJob}
      />

      {applyModalOpen && job && (
        <ApplyCandidateModal
          job={job}
          onClose={() => setApplyModalOpen(false)}
          onSuccess={handleApplyCandidateSuccess}
        />
      )}

      {reminderCandidate && (
        <SetReminderModal
          candidate={reminderCandidate}
          onClose={() => setReminderCandidate(null)}
        />
      )}

      <DropModal
        dropModalCandidate={pipeline.dropModalCandidate}
        setDropModalCandidate={pipeline.setDropModalCandidate}
        dropReason={pipeline.dropReason}
        setDropReason={pipeline.setDropReason}
        dropLoading={pipeline.dropLoading}
        handleDropConfirm={pipeline.handleDropConfirm}
      />

      <NewScheduleModal
        scheduleModalCandidate={pipeline.scheduleModalCandidate}
        scheduleModalRound={pipeline.scheduleModalRound}
        setScheduleModalCandidate={pipeline.setScheduleModalCandidate}
        setScheduleModalRound={pipeline.setScheduleModalRound}
        scheduleForm={pipeline.scheduleForm}
        setScheduleForm={pipeline.setScheduleForm}
        scheduleSubmitting={pipeline.scheduleSubmitting}
        usersList={share.usersList}
        usersLoading={share.usersLoading}
        handleNewScheduleSubmit={pipeline.handleNewScheduleSubmit}
      />
    </div>
  );
}
