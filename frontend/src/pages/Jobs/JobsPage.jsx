import React, { useState, useEffect } from 'react';
import { useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../../lib/useDebounce';
import { PageLoader } from '../../components/LoadingDots';
import { ROUTES } from '../../routes/constants';
import { Search, Briefcase, Users } from 'lucide-react';
import { useAuth } from '../../lib/authContext';

import { useJobs, useFilterOptions } from './hooks/useJobs';
import { useJobDetail } from './hooks/useJobDetail';
import { useCollaborators } from './hooks/useCollaborators';
import { useJobPipeline } from './hooks/useJobPipeline';
import { useResumeUpload } from '../Candidates/hooks/useResumeUpload';

import { jobsApi } from './services/jobsApi';
import { candidates as candidatesLibApi } from '../../lib/api';

import JobCard from './components/JobCard';
import JobFilters from './components/JobFilters';
import JobDetailPanel from './components/JobDetailPanel';
import JobEditModal from './components/JobEditModal';
import CollaboratorsModal from './components/CollaboratorsModal';
import ApplyCandidateModal from './components/ApplyCandidateModal';
import UploadResumeModal from '../Candidates/components/UploadResumeModal';
import ReviewResumeModal from '../Candidates/components/ReviewResumeModal';

export default function JobsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canUploadResume = user?.role === 'admin' || user?.role === 'recruiter';

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
  const interviewsMatch = useMatch(ROUTES.JOBS.INTERVIEWS_PATTERN);
  const matchJobId = detailMatch?.params?.jobId || interviewsMatch?.params?.jobId;

  const [viewingJob, setViewingJob] = useState(null);

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const jobDetail = useJobDetail({ setViewingJob });

  const collabs = useCollaborators({ viewingJob, setJobDetail: jobDetail.setJobDetail });

  const pipeline = useJobPipeline({ viewingJob, isPipelinePanelOpen: false });


  // ── Upload resume (job context) ────────────────────────────────────────────
  const [jobResumeActiveModal, setJobResumeActiveModal] = useState(null); // 'upload' | 'review' | null
  const jobResume = useResumeUpload({ setActiveModal: setJobResumeActiveModal });
  const [assignConflict, setAssignConflict] = useState(null); // { candidate, currentJob }

  // After a resume is converted, assign the candidate to the current job
  useEffect(() => {
    if (!jobResume.convertSuccess || !viewingJob) return;
    candidatesLibApi.assignJob(jobResume.convertSuccess.id, viewingJob.id)
      .then(() => {
        pipeline.setPipelineTab('Applied');
        pipeline.refreshAllCandidates(viewingJob.id);
      })
      .catch((err) => {
        if (err.status === 409 && err.data?.conflict) {
          setAssignConflict({ candidate: jobResume.convertSuccess, currentJob: err.data.current_job });
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobResume.convertSuccess]);

  const handleAssignConflictMove = async () => {
    if (!assignConflict || !viewingJob) return;
    try {
      await candidatesLibApi.moveJob(assignConflict.candidate.id, assignConflict.currentJob.id, viewingJob.id);
      setAssignConflict(null);
      pipeline.setPipelineTab('Applied');
      pipeline.refreshAllCandidates(viewingJob.id);
    } catch {
      setAssignConflict(null);
    }
  };

  const handleResumeApplyToJob = () => {
    // Called when user clicks "View in Pipeline" on the success screen
    pipeline.setPipelineTab('Applied');
    pipeline.refreshAllCandidates(viewingJob.id);
    navigate(ROUTES.JOBS.CANDIDATES(viewingJob.id));
  };

  // ── Apply existing candidate modal ────────────────────────────────────────
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyToast, setApplyToast] = useState('');

  const handleApplyCandidateSuccess = (candidate) => {
    pipeline.setPipelineTab('Applied');
    pipeline.refreshAllCandidates(viewingJob.id);
    setApplyToast(`${candidate.full_name} applied to ${viewingJob.title} successfully.`);
    setTimeout(() => setApplyToast(''), 4000);
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
    } else {
      setViewingJob(null);
      jobDetail.setJobDetail(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchJobId]);


  // ── Open job detail ────────────────────────────────────────────────────────
  const openJobDetails = (job) => {
    setViewingJob(job);
    navigate(ROUTES.JOBS.DETAIL(job.id));
  };

  return (
    <>
      {/* ══════════════════ JOB DETAIL VIEW ══════════════════ */}
      {(viewingJob || matchJobId) ? (
        <JobDetailPanel
          viewingJob={viewingJob}
          jobDetail={jobDetail.jobDetail}
          jobDetailLoading={jobDetail.jobDetailLoading}
          allCandidates={pipeline.allCandidates}
          allCandidatesLoading={pipeline.allCandidatesLoading}
          getStatCount={pipeline.getStatCount}
          openEdit={jobDetail.openEdit}
          setIsDeleteJobOpen={jobDetail.setIsDeleteJobOpen}
          openCollabModal={collabs.openCollabModal}
          onUploadResume={jobResume.openUploadModal}
          onApplyFromPool={() => setApplyModalOpen(true)}
          canUploadResume={canUploadResume}
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


      {/* Assign conflict dialog */}
      {assignConflict && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[600] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <p className="text-sm font-semibold text-slate-800">Candidate Already Applied</p>
            <p className="text-sm text-slate-600">
              <span className="font-medium">{assignConflict.candidate.full_name}</span> is currently applied to{' '}
              <span className="font-medium">{assignConflict.currentJob.job_code} — {assignConflict.currentJob.title}</span>.
              Move them to <span className="font-medium">{viewingJob?.job_code} — {viewingJob?.title}</span>?
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

      {/* Upload Resume (job context) */}
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
        targetJob={viewingJob}
        onApplyExisting={(candidate) => {
          jobResume.closeUploadModal();
          candidatesLibApi.assignJob(candidate.id, viewingJob.id)
            .then(() => {
              pipeline.refreshAllCandidates(viewingJob.id);
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
        targetJob={viewingJob}
        onApplyToJob={handleResumeApplyToJob}
      />

      {/* Apply from Talent Pool */}
      {applyModalOpen && viewingJob && (
        <ApplyCandidateModal
          job={viewingJob}
          onClose={() => setApplyModalOpen(false)}
          onSuccess={handleApplyCandidateSuccess}
        />
      )}


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
        handleCollabSearch={collabs.handleCollabSearch}
        handleAddCollab={collabs.handleAddCollab}
        handleRemoveCollab={collabs.handleRemoveCollab}
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


      {/* Apply / upload success toast */}
      {applyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] bg-green-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          {applyToast}
        </div>
      )}
    </>
  );
}
