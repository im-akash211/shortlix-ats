import React, { useState, useEffect } from 'react';
import { useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { useDebounce } from '../../lib/useDebounce';
import { PageLoader } from '../../components/LoadingDots';
import { ROUTES } from '../../routes/constants';
import { Search, Briefcase, UserPlus, X } from 'lucide-react';

import { useJobs, useFilterOptions } from './hooks/useJobs';
import { useJobDetail } from './hooks/useJobDetail';
import { useCollaborators } from './hooks/useCollaborators';
import { useJobPipeline } from './hooks/useJobPipeline';
import { useShare } from './hooks/useShare';

import { jobsApi, candidatesApi, interviewsApi } from './services/jobsApi';

import JobCard from './components/JobCard';
import JobFilters from './components/JobFilters';
import JobDetailPanel from './components/JobDetailPanel';
import PipelineView from './components/PipelineView';
import JobEditModal from './components/JobEditModal';
import CollaboratorsModal from './components/CollaboratorsModal';
import AddCandidateModal from './components/AddCandidateModal';
import ScheduleModal from './components/ScheduleModal';
import NewScheduleModal from './components/NewScheduleModal';
import DropModal from './components/DropModal';
import ResumeModal from './components/ResumeModal';

export default function JobsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── URL-based List state ───────────────────────────────────────────────────
  const activeTab = searchParams.get('tab') || 'All Jobs';
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';

  const setActiveTab = (val) => setSearchParams(p => { p.set('tab', val); return p; });
  const setSearch = (val) => setSearchParams(p => { if (val) p.set('search', val); else p.delete('search'); return p; });
  const setStatusFilter = (val) => setSearchParams(p => { p.set('status', val); return p; });

  // Phase C debounce
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 400);
  useEffect(() => {
    if (debouncedSearch !== search) setSearch(debouncedSearch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // ── URL-based Filter state ──────────────────────────────────────────────────
  const filters = {
    department:     searchParams.getAll('department'),
    hiring_manager: searchParams.getAll('hiring_manager'),
    location:       searchParams.getAll('location'),
  };
  const dateFrom = searchParams.get('date_from') || '';
  const dateTo   = searchParams.get('date_to')   || '';
  const ordering = searchParams.get('ordering')  || '-created_at';

  const setDateFrom = (val) => setSearchParams(p => { if (val) p.set('date_from', val); else p.delete('date_from'); return p; });
  const setDateTo   = (val) => setSearchParams(p => { if (val) p.set('date_to',   val); else p.delete('date_to');   return p; });
  const setOrdering = (val) => setSearchParams(p => { p.set('ordering', val); return p; });

  const toggleFilter = (key, id) => {
    setSearchParams(prev => {
      const current = prev.getAll(key);
      prev.delete(key);
      if (current.includes(id)) {
        current.filter(v => v !== id).forEach(v => prev.append(key, v));
      } else {
        [...current, id].forEach(v => prev.append(key, v));
      }
      return prev;
    });
  };

  const clearFilters = () => {
    setSearchParams(prev => {
      prev.delete('department');
      prev.delete('hiring_manager');
      prev.delete('location');
      prev.delete('date_from');
      prev.delete('date_to');
      return prev;
    });
  };

  const activeFilterCount =
    filters.department.length +
    filters.hiring_manager.length +
    filters.location.length +
    (dateFrom || dateTo ? 1 : 0);

  const { data: filterOptions = { departments: [], hiringManagers: [], locations: [] } } = useFilterOptions();
  const { jobsList, total, loading } = useJobs({ activeTab, statusFilter, search, filters, dateFrom, dateTo, ordering });

  // ── Job detail route ─────────────────────────────────────────────────────────
  const detailMatch = useMatch(ROUTES.JOBS.DETAIL_PATTERN);
  const candidatesMatch = useMatch(ROUTES.JOBS.CANDIDATES_PATTERN);
  const interviewsMatch = useMatch(ROUTES.JOBS.INTERVIEWS_PATTERN);
  const matchJobId = detailMatch?.params?.jobId || candidatesMatch?.params?.jobId || interviewsMatch?.params?.jobId;

  const [viewingJob, setViewingJob] = useState(null);
  const [isPipelinePanelOpen, setIsPipelinePanelOpen] = useState(false);

  const isCandidatesRoute = Boolean(candidatesMatch);

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const jobDetail = useJobDetail({ setViewingJob });

  const collabs = useCollaborators({ viewingJob, setJobDetail: jobDetail.setJobDetail });

  const pipeline = useJobPipeline({ viewingJob, isPipelinePanelOpen });

  const share = useShare();

  // ── Schedule modal extra state (ScheduleModal - old flow) ──────────────────
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleCandidate, setScheduleCandidate] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleToast, setScheduleToast] = useState(null);

  const closeScheduleModal = () => {
    setIsScheduleOpen(false);
    setScheduleCandidate(null);
    pipeline.setScheduleForm({ round_number: 1, round_label: '', interviewer: '', scheduled_at: '', duration_minutes: 60, mode: 'virtual', meeting_link: '' });
    setScheduleToast(null);
  };

  const handleScheduleSubmit = async () => {
    const { scheduleForm } = pipeline;
    if (!scheduleForm.interviewer || !scheduleForm.scheduled_at) return;
    setScheduleLoading(true);
    setScheduleToast(null);
    try {
      await interviewsApi.create({
        mapping:          scheduleCandidate.id,
        round_number:     Number(scheduleForm.round_number),
        round_label:      scheduleForm.round_label,
        interviewer:      scheduleForm.interviewer,
        scheduled_at:     new Date(scheduleForm.scheduled_at).toISOString(),
        duration_minutes: Number(scheduleForm.duration_minutes),
        mode:             scheduleForm.mode,
        meeting_link:     scheduleForm.meeting_link,
      });
      setScheduleToast({ type: 'success', message: 'Interview scheduled successfully.' });
      setTimeout(() => closeScheduleModal(), 1200);
    } catch (err) {
      setScheduleToast({ type: 'error', message: err.data?.detail || JSON.stringify(err.data) || 'Failed to schedule.' });
    } finally {
      setScheduleLoading(false);
    }
  };

  // ── Add Profile state ──────────────────────────────────────────────────────
  const [isAddProfileOpen, setIsAddProfileOpen] = useState(false);
  const [addProfileTargetJob, setAddProfileTargetJob] = useState(null);
  const [addForm, setAddForm] = useState({ full_name: '', email: '', phone: '', location: '', total_experience_years: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addProfileSuccess, setAddProfileSuccess] = useState('');

  const handleAddProfile = async () => {
    if (!addForm.full_name || !addForm.email) return;
    setAddLoading(true);
    const targetJob = addProfileTargetJob || viewingJob;
    try {
      const candidate = await candidatesApi.create({
        ...addForm,
        total_experience_years: addForm.total_experience_years || null,
        source: 'manual',
      });
      if (targetJob) await candidatesApi.assignJob(candidate.id, targetJob.id);
      setIsAddProfileOpen(false);
      setAddProfileTargetJob(null);
      setAddForm({ full_name: '', email: '', phone: '', location: '', total_experience_years: '' });
      if (viewingJob && targetJob?.id === viewingJob.id) {
        pipeline.setPipelineTab('Applied');
        setIsPipelinePanelOpen(true);
        pipeline.refreshAllCandidates(viewingJob.id);
      }
      setAddProfileSuccess(`Profile added successfully${targetJob ? ` to ${targetJob.title}` : ''}.`);
      setTimeout(() => setAddProfileSuccess(''), 4000);
    } catch (err) {
      alert(err.data?.email?.[0] || err.data?.detail || 'Failed to add profile');
    } finally {
      setAddLoading(false);
    }
  };

  // ── Candidate profile ──────────────────────────────────────────────────────
  const openCandidateProfile = (c) => {
    navigate(ROUTES.JOBS.CANDIDATE_PROFILE(viewingJob.id, c.candidate));
  };

  // ── Resume viewer state ────────────────────────────────────────────────────
  const [resumeModal, setResumeModal] = useState(null);
  const openResume = async (candidate) => {
    try {
      const files = candidate.resume_files || [];
      const latest = files.find(f => f.is_latest) || files[0];
      if (files.length === 0) { setResumeModal({ name: candidate.full_name, empty: true }); return; }
      if (!latest?.file_url) { setResumeModal({ name: candidate.full_name, missing: true }); return; }
      setResumeModal({ url: latest.file_url, filename: latest.original_filename, type: latest.file_type, name: candidate.full_name });
    } catch (err) {
      setResumeModal({ name: candidate.full_name, error: true });
    }
  };

  // ── Sync route param with detail view ─────────────────────────────────────
  useEffect(() => {
    if (matchJobId) {
      if (!jobDetail.jobDetail || String(jobDetail.jobDetail.id) !== String(matchJobId)) {
        jobDetail.setJobDetailLoading(true);
        jobsApi.detail(matchJobId)
          .then(data => {
            jobDetail.setJobDetail(data);
            setViewingJob(data);
          })
          .catch(console.error)
          .finally(() => jobDetail.setJobDetailLoading(false));
      }
      setIsPipelinePanelOpen(isCandidatesRoute);
    } else {
      setViewingJob(null);
      jobDetail.setJobDetail(null);
      setIsPipelinePanelOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchJobId, isCandidatesRoute]);

  // ── Load users when schedule modal opens ──────────────────────────────────
  useEffect(() => {
    if (!pipeline.scheduleModalCandidate) return;
    share.ensureUsersLoaded();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.scheduleModalCandidate]);

  // ── Open job detail ────────────────────────────────────────────────────────
  const openJobDetails = (job, tab = 'Applied', openPanel = false) => {
    setViewingJob(job);
    pipeline.setPipelineTab(tab);
    pipeline.setScreeningFilter('ALL');
    pipeline.setInterviewFilter('ALL');
    if (openPanel || tab !== 'Applied') {
      navigate(ROUTES.JOBS.CANDIDATES(job.id));
      pipeline.setDimmedLoading && pipeline.setDimmedLoading(true);
      pipeline.refreshDimmed(job.id, tab).finally(() => pipeline.setDimmedLoading && pipeline.setDimmedLoading(false));
    } else {
      navigate(ROUTES.JOBS.DETAIL(job.id));
    }
  };

  // Shared card props for CandidateCard/PipelineView
  const pipelineCardProps = {
    shareOpen: share.shareOpen, setShareOpen: share.setShareOpen,
    shareSearch: share.shareSearch, setShareSearch: share.setShareSearch,
    shareSelected: share.shareSelected, setShareSelected: share.setShareSelected,
    shareRef: share.shareRef,
    usersList: share.usersList, usersLoading: share.usersLoading,
    handleShare: share.handleShare,
    openCandidateProfile,
    handleShortlist: pipeline.handleShortlist, shortlistingId: pipeline.shortlistingId,
    handleScreeningStatus: pipeline.handleScreeningStatus,
    screeningStatusLoadingId: pipeline.screeningStatusLoadingId,
    getMoveToOptions: pipeline.getMoveToOptions,
    handleMoveToInterview: pipeline.handleMoveToInterview,
    handleMakeOffer: pipeline.handleMakeOffer,
    handleMarkJoined: pipeline.handleMarkJoined,
    handleRestoreToShortlist: pipeline.handleRestoreToShortlist, restoringId: pipeline.restoringId,
    setDropModalCandidate: pipeline.setDropModalCandidate,
    setDropReason: pipeline.setDropReason,
    handleNextRound: pipeline.handleNextRound, nextRoundLoading: pipeline.nextRoundLoading,
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

  return (
    <>
{/* Resume Viewer Modal */}
      <ResumeModal resumeModal={resumeModal} setResumeModal={setResumeModal} />

      {/* ══════════════════ JOB DETAIL VIEW ══════════════════ */}
      {(viewingJob || matchJobId) ? (
        <JobDetailPanel
          viewingJob={viewingJob}
          jobDetail={jobDetail.jobDetail}
          jobDetailLoading={jobDetail.jobDetailLoading}
          allCandidates={pipeline.allCandidates}
          allCandidatesLoading={pipeline.allCandidatesLoading}
          getStatCount={pipeline.getStatCount}
          setPipelineTab={pipeline.setPipelineTab}
          openEdit={jobDetail.openEdit}
          setIsDeleteJobOpen={jobDetail.setIsDeleteJobOpen}
          openCollabModal={collabs.openCollabModal}
          setIsAddProfileOpen={setIsAddProfileOpen}
        />
      ) : (
        /* ══════════════════ JOB LIST VIEW ══════════════════ */
        <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">

          {/* Tabs */}
          <div className="flex gap-6 mb-4 border-b border-slate-200">
            {['My Jobs', 'All Jobs'].map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`pb-3 border-b-2 font-semibold transition-colors ${activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Search + status bar */}
          <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 mb-5 shadow-sm gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
                placeholder="Search jobs by title, code, location…"
                className="outline-none w-full text-sm"
              />
            </div>
            <div className="text-sm font-medium text-slate-600 px-4 border-x border-slate-200 italic shrink-0">
              {total} Jobs Found
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-600 shrink-0">
              {['open', 'abandoned', 'closed', 'all'].map((s) => (
                <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    className="accent-blue-600"
                    checked={statusFilter === s}
                    onChange={() => setStatusFilter(s)}
                  />
                  <span className="capitalize">{s}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Jobs + Filters */}
          <div className="flex gap-5 flex-1 min-h-0 overflow-hidden">

            {/* LEFT: Job cards */}
            <div className="flex-1 min-h-0 overflow-y-auto pb-4 flex flex-col gap-4">
              {loading ? (
                <PageLoader label="Loading jobs…" />
              ) : jobsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                  <Briefcase className="w-10 h-10 text-slate-300" />
                  <p className="text-sm">No jobs found.</p>
                </div>
              ) : (
                jobsList.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onView={(j) => openJobDetails(j)}
                    onOpenPipeline={(j, tab) => openJobDetails(j, tab, true)}
                    onAddProfile={(j) => { setAddProfileTargetJob(j); setIsAddProfileOpen(true); }}
                    onCollaborators={(j) => collabs.openCollabModal(j)}
                  />
                ))
              )}
            </div>

            {/* RIGHT: Filter panel */}
            <JobFilters
              filterOptions={filterOptions}
              filters={filters}
              activeFilterCount={activeFilterCount}
              onToggle={toggleFilter}
              onClearFilters={clearFilters}
              dateFrom={dateFrom}
              dateTo={dateTo}
              ordering={ordering}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onOrderingChange={setOrdering}
            />
          </div>
        </div>
      )}

      {/* ══════════════════ PIPELINE SLIDE-OVER PANEL ══════════════════ */}
      {isPipelinePanelOpen && viewingJob && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => { pipeline.setScreeningFilter('ALL'); pipeline.setInterviewFilter('ALL'); navigate(ROUTES.JOBS.DETAIL(viewingJob.id)); }}
          />

          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-[50vw] min-w-[550px] max-w-[95vw] bg-white shadow-2xl z-50 flex flex-col">

            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 truncate">{viewingJob.job_code} — {viewingJob.title}</p>
                <h3 className="text-base font-bold text-slate-800 mt-0.5">{pipeline.pipelineTab}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  onClick={() => setIsAddProfileOpen(true)}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Profile
                </button>
                <button
                  onClick={() => { pipeline.setScreeningFilter('ALL'); pipeline.setInterviewFilter('ALL'); navigate(ROUTES.JOBS.DETAIL(viewingJob.id)); }}
                  className="text-slate-400 hover:text-slate-700 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <PipelineView
              pipelineTab={pipeline.pipelineTab}
              allCandidates={pipeline.allCandidates}
              allCandidatesLoading={pipeline.allCandidatesLoading}
              dimmedCandidates={pipeline.dimmedCandidates}
              dimmedLoading={pipeline.dimmedLoading}
              screeningFilter={pipeline.screeningFilter} setScreeningFilter={pipeline.setScreeningFilter}
              interviewFilter={pipeline.interviewFilter} setInterviewFilter={pipeline.setInterviewFilter}
              offeredFilter={pipeline.offeredFilter} setOfferedFilter={pipeline.setOfferedFilter}
              onTabChange={(tab) => { pipeline.setPipelineTab(tab); pipeline.setScreeningFilter('ALL'); pipeline.setInterviewFilter('ALL'); }}
              getStatCount={pipeline.getStatCount}
              {...pipelineCardProps}
            />
          </div>
        </>
      )}

      {/* Drop Candidate Modal */}
      <DropModal
        dropModalCandidate={pipeline.dropModalCandidate}
        setDropModalCandidate={pipeline.setDropModalCandidate}
        dropReason={pipeline.dropReason}
        setDropReason={pipeline.setDropReason}
        dropLoading={pipeline.dropLoading}
        handleDropConfirm={pipeline.handleDropConfirm}
      />

      {/* New Schedule Modal (from pipeline) */}
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

      {/* Close Job Confirmation */}
      {jobDetail.isCloseConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[300]">
          <div className="bg-white rounded-xl shadow-2xl w-[420px] max-w-[92vw] p-6 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-slate-800">Close this job?</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Closing a job is <strong>permanent and irreversible</strong>. Once closed, the status
              cannot be changed and the job cannot be reopened or abandoned.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => jobDetail.setIsCloseConfirmOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  jobDetail.setEditForm((f) => ({ ...f, status: 'closed' }));
                  jobDetail.setIsCloseConfirmOpen(false);
                }}
                className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium transition-colors"
              >
                Yes, Close Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      <JobEditModal
        isEditOpen={jobDetail.isEditOpen}
        setIsEditOpen={jobDetail.setIsEditOpen}
        jobDetail={jobDetail.jobDetail}
        editForm={jobDetail.editForm}
        setEditForm={jobDetail.setEditForm}
        editLoading={jobDetail.editLoading}
        handleEditSave={jobDetail.handleEditSave}
        setIsCloseConfirmOpen={jobDetail.setIsCloseConfirmOpen}
      />

      {/* Collaborators Modal */}
      <CollaboratorsModal
        isCollabModalOpen={collabs.isCollabModalOpen}
        setIsCollabModalOpen={collabs.setIsCollabModalOpen}
        selectedJob={collabs.selectedJob}
        collabList={collabs.collabList}
        collabLoading={collabs.collabLoading}
        collabEmail={collabs.collabEmail} setCollabEmail={collabs.setCollabEmail}
        collabSearchResults={collabs.collabSearchResults}
        collabSearchLoading={collabs.collabSearchLoading}
        collabActionLoading={collabs.collabActionLoading}
        collabError={collabs.collabError}
        collabSuccess={collabs.collabSuccess}
        recruiterUsers={collabs.recruiterUsers}
        collabFilter={collabs.collabFilter} setCollabFilter={collabs.setCollabFilter}
        collabInputFocused={collabs.collabInputFocused} setCollabInputFocused={collabs.setCollabInputFocused}
        handleCollabSearch={collabs.handleCollabSearch}
        handleAddCollab={collabs.handleAddCollab}
        handleRemoveCollab={collabs.handleRemoveCollab}
      />

      {/* Add Profile Modal */}
      <AddCandidateModal
        isAddProfileOpen={isAddProfileOpen}
        setIsAddProfileOpen={setIsAddProfileOpen}
        setAddProfileTargetJob={setAddProfileTargetJob}
        addForm={addForm}
        setAddForm={setAddForm}
        addLoading={addLoading}
        handleAddProfile={handleAddProfile}
      />

      {/* Schedule Interview Modal (old flow) */}
      <ScheduleModal
        isScheduleOpen={isScheduleOpen}
        scheduleCandidate={scheduleCandidate}
        scheduleForm={pipeline.scheduleForm}
        setScheduleForm={pipeline.setScheduleForm}
        scheduleLoading={scheduleLoading}
        scheduleToast={scheduleToast}
        usersList={share.usersList}
        closeScheduleModal={closeScheduleModal}
        handleScheduleSubmit={handleScheduleSubmit}
      />

      {/* Delete Job Confirmation Modal */}
      {jobDetail.isDeleteJobOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[440px] max-w-[92vw] p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Delete Job</h3>
                <p className="text-xs text-slate-500 mt-0.5">{jobDetail.jobDetail?.job_code} — {jobDetail.jobDetail?.title}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete this job? This action <span className="font-semibold text-rose-600">cannot be undone</span> and will remove all associated pipeline data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => jobDetail.setIsDeleteJobOpen(false)}
                disabled={jobDetail.deleteJobLoading}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={jobDetail.handleDeleteJob}
                disabled={jobDetail.deleteJobLoading}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {jobDetail.deleteJobLoading ? 'Deleting…' : 'Yes, Delete Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share success toast */}
      {share.shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] bg-green-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          {share.shareToast}
        </div>
      )}

      {/* Add Profile success toast */}
      {addProfileSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] bg-green-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          {addProfileSuccess}
        </div>
      )}
    </>
  );
}
