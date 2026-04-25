import React, { useState, useEffect, useRef } from 'react';
import { useDebounce } from '../../lib/useDebounce';
import { PageLoader } from '../../components/LoadingDots';
import { Search, Upload, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, X } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { useQueryClient } from '@tanstack/react-query';

import { useCandidates } from './hooks/useCandidates';
import { useCandidateModals } from './hooks/useCandidateModals';
import { useResumeUpload } from './hooks/useResumeUpload';
import { useShare } from './hooks/useShare';

import CandidateRow from './components/CandidateRow';
import CandidateFilters from './components/CandidateFilters';
import ViewProfileModal from './components/ViewProfileModal';
import EditProfileModal from './components/EditProfileModal';
import AddNoteModal from './components/AddNoteModal';
import MoveJobModal from './components/MoveJobModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import ResumeModal from './components/ResumeModal';
import UploadResumeModal from './components/UploadResumeModal';
import ReviewResumeModal from './components/ReviewResumeModal';

import { SOURCE_LABELS, STAGE_LABELS } from './constants';

export default function CandidatesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    candidates,
    total,
    loading,
    allJobs,
    search,
    urlSources,
    urlStages,
    urlTags,
    urlJob,
    expMin,
    expMax,
    dateFrom,
    dateTo,
    sortKey,
    activeFilterCount,
    setSearch,
    setSearchParams,
    setExpFilter,
    setSort,
    toggleArrayFilter,
    clearAllFilters,
  } = useCandidates();

  const modals = useCandidateModals();

  const resumeUpload = useResumeUpload({ setActiveModal: modals.setActiveModal });

  const share = useShare();

  // Phase C debounce: local input state so typing is instant
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 400);
  useEffect(() => {
    if (debouncedSearch !== search) setSearch(debouncedSearch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Column-header filter dropdown state
  const [colDropdown, setColDropdown] = useState(null);
  const colDropdownRef = useRef(null);
  useEffect(() => {
    if (!colDropdown) return;
    const handler = (e) => { if (colDropdownRef.current && !colDropdownRef.current.contains(e.target)) setColDropdown(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colDropdown]);

  const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput); };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">

      {/* Top bar */}
      <div className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-medium">Talent Pool</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={resumeUpload.openUploadModal}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Resume
          </button>
          <span className="text-sm">Welcome, {user?.full_name || 'User'}</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-6 flex-1 min-h-0 p-6 overflow-hidden">

        {/* ── Left: table ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

          {/* Search / toolbar */}
          <div className="p-4 border-b border-slate-200 flex items-center gap-4 shrink-0">
            <form onSubmit={handleSearch} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center border border-slate-300 rounded-md overflow-hidden bg-white w-96 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search by name, email, skills, tags…"
                    className="w-full px-3 py-2 text-sm outline-none"
                  />
                  <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Search className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
              <span className="text-xs text-slate-500 shrink-0">{total} Profiles found</span>
            </form>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-blue-600 hover:underline font-medium shrink-0"
              >
                Clear Filters ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1">
            {loading ? (
              <PageLoader label="Loading candidates…" />
            ) : (
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-10 shadow-sm" ref={colDropdownRef}>
                  <tr>
                    {/* Applicant — sortable */}
                    <th className="px-2 py-1 border-b border-slate-200 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSort('full_name')}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          Applicant
                          {sortKey === 'full_name' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : sortKey === '-full_name' ? <ArrowDown className="w-3 h-3 text-blue-600" /> : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                        </button>
                      </div>
                    </th>

                    {/* Job Applied */}
                    <th className="px-2 py-1 border-b border-slate-200 text-xs">Job Applied</th>

                    {/* Status — filterable via dropdown */}
                    <th className="px-2 py-1 border-b border-slate-200 text-xs">
                      <div className="relative">
                        <button
                          onClick={() => setColDropdown(colDropdown === 'status' ? null : 'status')}
                          className={`flex items-center gap-1 hover:text-blue-600 transition-colors ${urlStages.length > 0 ? 'text-blue-600' : ''}`}
                        >
                          Status
                          {urlStages.length > 0 && <span className="bg-blue-600 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{urlStages.length}</span>}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {colDropdown === 'status' && (
                          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-30 min-w-[180px] py-1">
                            {Object.entries(STAGE_LABELS).map(([key, label]) => (
                              <label key={key} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs font-normal text-slate-700">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 accent-blue-600"
                                  checked={urlStages.includes(key)}
                                  onChange={() => toggleArrayFilter('stage', key)}
                                />
                                {label}
                              </label>
                            ))}
                            {urlStages.length > 0 && (
                              <button
                                onClick={() => { setSearchParams(p => { p.delete('stage'); return p; }, { replace: true }); setColDropdown(null); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-rose-500 hover:bg-rose-50 border-t border-slate-100 mt-1"
                              >
                                Clear filter
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </th>

                    {/* Source — filterable via dropdown */}
                    <th className="px-2 py-1 border-b border-slate-200 text-xs">
                      <div className="relative">
                        <button
                          onClick={() => setColDropdown(colDropdown === 'source' ? null : 'source')}
                          className={`flex items-center gap-1 hover:text-blue-600 transition-colors ${urlSources.length > 0 ? 'text-blue-600' : ''}`}
                        >
                          Source
                          {urlSources.length > 0 && <span className="bg-blue-600 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{urlSources.length}</span>}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {colDropdown === 'source' && (
                          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-30 min-w-[180px] py-1">
                            {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                              <label key={key} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs font-normal text-slate-700">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 accent-blue-600"
                                  checked={urlSources.includes(key)}
                                  onChange={() => toggleArrayFilter('source', key)}
                                />
                                {label}
                              </label>
                            ))}
                            {urlSources.length > 0 && (
                              <button
                                onClick={() => { setSearchParams(p => { p.delete('source'); return p; }, { replace: true }); setColDropdown(null); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-rose-500 hover:bg-rose-50 border-t border-slate-100 mt-1"
                              >
                                Clear filter
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </th>

                    {/* Date Added — sortable */}
                    <th className="px-2 py-1 border-b border-slate-200 text-xs">
                      <button
                        onClick={() => setSort('created_at')}
                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                      >
                        Date Added
                        {sortKey === 'created_at' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : sortKey === '-created_at' ? <ArrowDown className="w-3 h-3 text-blue-600" /> : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </button>
                    </th>

                    <th className="px-3 py-1.5 border-b border-slate-200 text-xs text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map((c) => (
                    <CandidateRow
                      key={c.id}
                      candidate={c}
                      openModal={modals.openModal}
                      openShare={share.openShare}
                      openViewProfile={modals.openViewProfile}
                      openDeleteConfirm={modals.openDeleteConfirm}
                      openResume={modals.openResume}
                      shareOpen={share.shareOpen}
                    />
                  ))}
                  {candidates.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-slate-400">No candidates found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Right: filters sidebar ── */}
        <CandidateFilters
          activeFilterCount={activeFilterCount}
          urlSources={urlSources}
          urlStages={urlStages}
          urlTags={urlTags}
          urlJob={urlJob}
          expMin={expMin}
          expMax={expMax}
          dateFrom={dateFrom}
          dateTo={dateTo}
          allJobs={allJobs}
          toggleArrayFilter={toggleArrayFilter}
          clearAllFilters={clearAllFilters}
          setSearchParams={setSearchParams}
          setExpFilter={setExpFilter}
        />
      </div>

      {/* ══════════ MODALS ══════════ */}

      <ViewProfileModal
        isOpen={modals.activeModal === 'view'}
        onClose={modals.closeModal}
        profileLoading={modals.profileLoading}
        profileDetail={modals.profileDetail}
        user={user}
        openResume={modals.openResume}
        openModal={modals.openModal}
        openDeleteConfirm={modals.openDeleteConfirm}
      />

      <EditProfileModal
        isOpen={modals.activeModal === 'edit'}
        onClose={modals.closeModal}
        selectedCandidate={modals.selectedCandidate}
        editForm={modals.editForm}
        setEditForm={modals.setEditForm}
        editLoading={modals.editLoading}
        handleEditSave={modals.handleEditSave}
        user={user}
      />

      <AddNoteModal
        isOpen={modals.activeModal === 'note'}
        onClose={modals.closeModal}
        selectedCandidate={modals.selectedCandidate}
        noteText={modals.noteText}
        setNoteText={modals.setNoteText}
        noteLoading={modals.noteLoading}
        handleSaveNote={modals.handleSaveNote}
      />

      <MoveJobModal
        isOpen={modals.activeModal === 'move'}
        onClose={modals.closeModal}
        moveJobId={modals.moveJobId}
        setMoveJobId={modals.setMoveJobId}
        allJobs={allJobs}
        handleMove={modals.handleMove}
      />

      <DeleteConfirmModal
        isDeleteOpen={modals.isDeleteOpen}
        deleteTarget={modals.deleteTarget}
        deleteLoading={modals.deleteLoading}
        setIsDeleteOpen={modals.setIsDeleteOpen}
        setDeleteTarget={modals.setDeleteTarget}
        handleDeleteCandidate={modals.handleDeleteCandidate}
      />

      <ResumeModal
        resumeModal={modals.resumeModal}
        setResumeModal={modals.setResumeModal}
      />

      <UploadResumeModal
        isOpen={modals.activeModal === 'upload'}
        onClose={resumeUpload.closeUploadModal}
        uploadFile={resumeUpload.uploadFile}
        uploadLoading={resumeUpload.uploadLoading}
        uploadResult={resumeUpload.uploadResult}
        uploadError={resumeUpload.uploadError}
        uploadDuplicate={resumeUpload.uploadDuplicate}
        existingCandidate={resumeUpload.existingCandidate}
        fileInputRef={resumeUpload.fileInputRef}
        handleFileSelect={resumeUpload.handleFileSelect}
        handleUploadSubmit={resumeUpload.handleUploadSubmit}
        openReviewModal={resumeUpload.openReviewModal}
        setUploadResult={resumeUpload.setUploadResult}
        setUploadFile={resumeUpload.setUploadFile}
        setUploadError={resumeUpload.setUploadError}
      />

      <ReviewResumeModal
        isOpen={modals.activeModal === 'review'}
        onClose={resumeUpload.closeReviewModal}
        reviewIngestion={resumeUpload.reviewIngestion}
        reviewForm={resumeUpload.reviewForm}
        reviewLoading={resumeUpload.reviewLoading}
        reviewSaved={resumeUpload.reviewSaved}
        convertLoading={resumeUpload.convertLoading}
        duplicateInfo={resumeUpload.duplicateInfo}
        resolveLoading={resumeUpload.resolveLoading}
        convertSuccess={resumeUpload.convertSuccess}
        reviewError={resumeUpload.reviewError}
        setReviewField={resumeUpload.setReviewField}
        updateEducation={resumeUpload.updateEducation}
        addEducation={resumeUpload.addEducation}
        removeEducation={resumeUpload.removeEducation}
        handleSaveReview={resumeUpload.handleSaveReview}
        handleConvert={resumeUpload.handleConvert}
        handleResolveDuplicate={resumeUpload.handleResolveDuplicate}
        queryClient={queryClient}
      />

      {/* ══════════ SHARE MODAL ══════════ */}
      {share.shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] bg-green-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          {share.shareToast}
        </div>
      )}

      {share.shareOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div ref={share.shareRef} className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Share Candidate Profile</h3>
              <button onClick={() => { share.setShareOpen(null); share.setShareSearch(''); share.setShareSelected([]); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Search */}
            <div className="px-5 py-3 border-b border-slate-100">
              <input autoFocus type="text" placeholder="Search users..." value={share.shareSearch} onChange={e => share.setShareSearch(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
            </div>
            {/* User list */}
            <div className="overflow-y-auto max-h-64">
              {share.usersLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                  <svg className="animate-spin w-4 h-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                  <span className="text-xs">Loading users...</span>
                </div>
              ) : share.usersList.filter(u => u.full_name.toLowerCase().includes(share.shareSearch.toLowerCase())).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No users found</p>
              ) : share.usersList.filter(u => u.full_name.toLowerCase().includes(share.shareSearch.toLowerCase())).map(u => (
                <label key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0">
                  <input type="checkbox" checked={share.shareSelected.includes(u.id)} onChange={() => share.setShareSelected(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} className="accent-blue-600 w-4 h-4 shrink-0" />
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                    {u.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{u.full_name}</p>
                    <p className="text-xs text-slate-400 capitalize">{u.role?.replace('_', ' ')}</p>
                  </div>
                </label>
              ))}
            </div>
            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">{share.shareSelected.length > 0 ? `${share.shareSelected.length} user${share.shareSelected.length > 1 ? 's' : ''} selected` : 'Select users to share with'}</span>
              <div className="flex gap-2">
                <button onClick={() => { share.setShareOpen(null); share.setShareSearch(''); share.setShareSelected([]); }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                <button
                  disabled={share.shareSelected.length === 0}
                  onClick={share.handleShare}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors font-medium"
                >
                  Share{share.shareSelected.length > 0 ? ` (${share.shareSelected.length})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
