import { useState, useEffect } from 'react';
import { useNavigate, useMatch } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { candidatesApi } from '../services/candidatesApi';
import { ROUTES } from '../../../routes/constants';

export function useCandidateModals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const viewMatch = useMatch(ROUTES.CANDIDATES.DETAIL_PATTERN);
  const editMatch = useMatch(ROUTES.CANDIDATES.EDIT_PATTERN);
  const routeCandidateId = viewMatch?.params?.candidateId || editMatch?.params?.candidateId;

  const [activeModal, setActiveModal]             = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  // View profile
  const [profileDetail, setProfileDetail]   = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Resume viewer
  const [resumeModal, setResumeModal] = useState(null);

  // Edit modal
  const [editForm, setEditForm]       = useState({});
  const [editLoading, setEditLoading] = useState(false);

  // Note modal
  const [noteText, setNoteText]       = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  // Move modal
  const [moveJobId, setMoveJobId] = useState('');

  // Delete candidate
  const [isDeleteOpen, setIsDeleteOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Sync URL route → modal open/close for view and edit
  useEffect(() => {
    if (routeCandidateId) {
      const targetModal = editMatch ? 'edit' : 'view';
      setActiveModal(targetModal);
      setProfileDetail(null);
      setProfileLoading(true);
      candidatesApi.detail(routeCandidateId)
        .then((detail) => {
          setSelectedCandidate(detail);
          setProfileDetail(detail);
          if (editMatch) {
            setEditForm({
              full_name:              detail.full_name || '',
              email:                  detail.email || '',
              phone:                  detail.phone || '',
              designation:            detail.designation || '',
              current_employer:       detail.current_employer || '',
              location:               detail.location || '',
              native_location:        detail.native_location || '',
              total_experience_years: detail.total_experience_years ?? '',
              ctc_fixed_lakhs:        detail.ctc_fixed_lakhs ?? '',
              ctc_variable_lakhs:     detail.ctc_variable_lakhs ?? '',
              current_ctc_lakhs:      detail.current_ctc_lakhs ?? '',
              expected_ctc_lakhs:     detail.expected_ctc_lakhs ?? '',
              offers_in_hand:         detail.offers_in_hand || '',
              notice_period_days:     detail.notice_period_days ?? '',
              notice_period_status:   detail.notice_period_status || '',
              reason_for_change:      detail.reason_for_change || '',
              skills:                 detail.skills || [],
            });
          }
        })
        .catch(console.error)
        .finally(() => setProfileLoading(false));
    } else if (activeModal === 'view' || activeModal === 'edit') {
      setActiveModal(null);
      setSelectedCandidate(null);
      setProfileDetail(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCandidateId, editMatch]);

  const openModal = (type, candidate) => {
    if (type === 'edit') {
      navigate(ROUTES.CANDIDATES.EDIT(candidate.id));
      return;
    }
    setSelectedCandidate(candidate);
    setActiveModal(type);
    setNoteText('');
    setMoveJobId('');
  };

  const openViewProfile = (candidate) => {
    navigate(ROUTES.CANDIDATES.PROFILE(candidate.id));
  };

  const closeModal = () => {
    if (activeModal === 'view' || activeModal === 'edit') {
      navigate(ROUTES.CANDIDATES.ROOT, { replace: true });
    } else {
      setActiveModal(null);
      setSelectedCandidate(null);
      setProfileDetail(null);
    }
  };

  const openResume = async (c) => {
    try {
      const detail = await candidatesApi.detail(c.id);
      const files = detail.resume_files || [];
      const latest = files.find(f => f.is_latest) || files[0];

      if (files.length === 0) {
        setResumeModal({ name: c.full_name, empty: true });
        return;
      }
      if (!latest?.file_url) {
        setResumeModal({ name: c.full_name, missing: true });
        return;
      }

      setResumeModal({ url: latest.file_url, filename: latest.original_filename, type: latest.file_type, name: c.full_name });
    } catch (err) {
      setResumeModal({ name: c.full_name, error: true });
    }
  };

  const handleEditSave = async () => {
    if (!selectedCandidate) return;
    setEditLoading(true);
    try {
      const toNum = (v) => (v !== '' && v != null) ? Number(v) : null;
      const payload = {
        ...editForm,
        total_experience_years: toNum(editForm.total_experience_years),
        ctc_fixed_lakhs:        toNum(editForm.ctc_fixed_lakhs),
        ctc_variable_lakhs:     toNum(editForm.ctc_variable_lakhs),
        current_ctc_lakhs:      toNum(editForm.current_ctc_lakhs),
        expected_ctc_lakhs:     toNum(editForm.expected_ctc_lakhs),
        notice_period_days:     toNum(editForm.notice_period_days),
      };
      await candidatesApi.update(selectedCandidate.id, payload);
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['candidates', 'list'] });
    } catch (err) {
      alert(err.data?.detail || JSON.stringify(err.data) || 'Failed to save changes');
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !selectedCandidate) return;
    setNoteLoading(true);
    try {
      await candidatesApi.addNote(selectedCandidate.id, noteText);
      closeModal();
    } catch {
      alert('Failed to save note');
    } finally {
      setNoteLoading(false);
    }
  };

  const handleMove = async () => {
    if (!moveJobId || !selectedCandidate) return;
    try {
      // moveJob auto-detects the current job on the backend (from_job_id optional)
      await candidatesApi.moveJob(selectedCandidate.id, null, moveJobId);
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['candidates', 'list'] });
    } catch (err) {
      alert(err.data?.error || 'Failed to move candidate');
    }
  };

  const openDeleteConfirm = (candidate) => {
    setDeleteTarget(candidate);
    setIsDeleteOpen(true);
  };

  const handleDeleteCandidate = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await candidatesApi.delete(deleteTarget.id);
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      if (activeModal === 'view' && selectedCandidate?.id === deleteTarget.id) closeModal();
      queryClient.invalidateQueries({ queryKey: ['candidates', 'list'] });
    } catch (err) {
      alert(err.data?.detail || 'Failed to delete candidate');
    } finally {
      setDeleteLoading(false);
    }
  };

  return {
    activeModal,
    setActiveModal,
    selectedCandidate,
    profileDetail,
    profileLoading,
    resumeModal,
    setResumeModal,
    editForm,
    setEditForm,
    editLoading,
    noteText,
    setNoteText,
    noteLoading,
    moveJobId,
    setMoveJobId,
    isDeleteOpen,
    setIsDeleteOpen,
    deleteTarget,
    setDeleteTarget,
    deleteLoading,
    // handlers
    openModal,
    openViewProfile,
    closeModal,
    openResume,
    handleEditSave,
    handleSaveNote,
    handleMove,
    openDeleteConfirm,
    handleDeleteCandidate,
  };
}
