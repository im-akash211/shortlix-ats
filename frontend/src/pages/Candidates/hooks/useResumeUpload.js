import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { resumesApi } from '../services/candidatesApi';
import { BLANK_REVIEW } from '../constants';

export function useResumeUpload({ setActiveModal }) {
  const queryClient = useQueryClient();

  const [uploadFile, setUploadFile]               = useState(null);
  const [uploadLoading, setUploadLoading]         = useState(false);
  const [uploadResult, setUploadResult]           = useState(null);
  const [uploadError, setUploadError]             = useState('');
  const [uploadDuplicate, setUploadDuplicate]     = useState(null);
  const [existingCandidate, setExistingCandidate] = useState(null);
  const fileInputRef                        = useRef(null);
  const pollIntervalRef                     = useRef(null);

  // Review modal state
  const [reviewIngestion, setReviewIngestion]   = useState(null);
  const [reviewForm, setReviewForm]             = useState(BLANK_REVIEW);
  const [reviewLoading, setReviewLoading]       = useState(false);
  const [reviewSaved, setReviewSaved]           = useState(false);
  const [convertLoading, setConvertLoading]     = useState(false);
  const [duplicateInfo, setDuplicateInfo]       = useState(null);
  const [resolveLoading, setResolveLoading]     = useState(false);
  const [convertSuccess, setConvertSuccess]     = useState(null);
  const [reviewError, setReviewError]           = useState('');

  const openUploadModal = () => {
    setUploadFile(null);
    setUploadResult(null);
    setUploadError('');
    setUploadDuplicate(null);
    setUploadLoading(false);
    setExistingCandidate(null);
    setActiveModal('upload');
  };

  const closeUploadModal = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setActiveModal(null);
    setUploadFile(null);
    setUploadResult(null);
    setUploadError('');
    setUploadDuplicate(null);
    setExistingCandidate(null);
  };

  const openReviewModal = (ingestion) => {
    const data = ingestion.parsed_data?.reviewed_output || ingestion.parsed_data?.llm_output || {};
    setReviewIngestion(ingestion);
    setReviewForm({
      first_name:         data.first_name         ?? '',
      last_name:          data.last_name          ?? '',
      email:              data.email              ?? '',
      phone:              data.phone              ?? '',
      designation:        data.designation        ?? '',
      current_company:    data.current_company    ?? '',
      experience_years:   data.experience_years   ?? '',
      expected_ctc_lakhs: data.expected_ctc_lakhs ?? '',
      skills:             Array.isArray(data.skills) ? data.skills : [],
      education:          Array.isArray(data.education) ? data.education : [],
    });
    setReviewSaved(ingestion.status === 'reviewed');
    setDuplicateInfo(null);
    setConvertSuccess(null);
    setReviewError('');
    setActiveModal('review');
  };

  const closeReviewModal = async () => {
    // If not yet converted, delete the temp file from S3
    if (reviewIngestion && !convertSuccess) {
      try { await resumesApi.discard(reviewIngestion.id); } catch { /* best effort */ }
    }
    setActiveModal(null);
    setReviewIngestion(null);
    setDuplicateInfo(null);
    setConvertSuccess(null);
    setReviewError('');
  };

  const setReviewField = (field, value) =>
    setReviewForm(prev => ({ ...prev, [field]: value }));

  const updateEducation = (idx, field, value) =>
    setReviewForm(prev => ({
      ...prev,
      education: prev.education.map((e, i) => i === idx ? { ...e, [field]: value } : e),
    }));

  const addEducation = () =>
    setReviewForm(prev => ({
      ...prev,
      education: [...prev.education, { degree: '', institution: '', year: '' }],
    }));

  const removeEducation = (idx) =>
    setReviewForm(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== idx),
    }));

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      setUploadError('Only PDF and DOCX files are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File exceeds the 10 MB size limit.');
      return;
    }
    setUploadError('');
    setUploadFile(file);
  };

  const startPolling = (ingestionId) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const record = await resumesApi.status(ingestionId);
        setUploadResult(record);
        const terminal = ['parsed', 'failed', 'review_pending'];
        if (terminal.includes(record.status)) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          // Auto-transition: go straight to preview modal when parsed
          if (record.status === 'parsed') {
            setActiveModal(null);
            openReviewModal(record);
          }
        }
      } catch {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }, 2500);
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) return;
    setUploadLoading(true);
    setUploadError('');
    setUploadDuplicate(null);
    try {
      const record = await resumesApi.upload(uploadFile);

      if (record.status === 'resume_existing') {
        // Same file already in temp — resume the flow with existing ingestion
        closeUploadModal();
        openReviewModal(record.ingestion);
        return;
      }

      if (record.status === 'parsed') {
        // Already parsed — skip the upload modal entirely, go straight to preview
        openReviewModal(record);
      } else {
        setUploadResult(record);
        if (!['failed', 'review_pending'].includes(record.status)) {
          startPolling(record.id);
        }
      }
    } catch (err) {
      if (err.status === 409 && err.data?.status === 'already_converted') {
        setExistingCandidate(err.data.candidate);
      } else if (err.status === 409 && err.data?.duplicate) {
        setUploadDuplicate(err.data);
      } else {
        const msg = err.data?.file?.[0] || err.data?.detail || err.message || 'Upload failed';
        setUploadError(msg);
      }
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSaveReview = async () => {
    if (!reviewIngestion) return;
    setReviewLoading(true);
    setReviewError('');
    try {
      const payload = {
        ...reviewForm,
        experience_years: reviewForm.experience_years !== '' ? Number(reviewForm.experience_years) : null,
      };
      await resumesApi.review(reviewIngestion.id, payload);
      setReviewSaved(true);
      setReviewIngestion(prev => ({ ...prev, status: 'reviewed' }));
    } catch (err) {
      setReviewError(err.data?.detail || JSON.stringify(err.data) || 'Failed to save review.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!reviewIngestion) return;
    setConvertLoading(true);
    setReviewError('');
    try {
      // Auto-save reviewed data before converting (Page 2 Save button)
      const payload = {
        ...reviewForm,
        experience_years: reviewForm.experience_years !== '' ? Number(reviewForm.experience_years) : null,
      };
      await resumesApi.review(reviewIngestion.id, payload);

      const result = await resumesApi.convert(reviewIngestion.id);
      if (result.status === 'duplicate_found') {
        setDuplicateInfo({ candidates: result.duplicate_candidates, matchType: result.match_type });
      } else {
        setConvertSuccess(result.candidate);
        queryClient.invalidateQueries({ queryKey: ['candidates', 'list'] });
      }
    } catch (err) {
      setReviewError(err.data?.detail || 'Conversion failed.');
    } finally {
      setConvertLoading(false);
    }
  };

  const handleResolveDuplicate = async (decision) => {
    if (!reviewIngestion) return;
    setResolveLoading(true);
    setReviewError('');
    try {
      const result = await resumesApi.resolveDuplicate(reviewIngestion.id, decision);
      if (decision === 'discard') {
        closeReviewModal();
      } else {
        setConvertSuccess(result.candidate);
        setDuplicateInfo(null);
        queryClient.invalidateQueries({ queryKey: ['candidates', 'list'] });
      }
    } catch (err) {
      setReviewError(err.data?.detail || 'Failed to resolve duplicate.');
    } finally {
      setResolveLoading(false);
    }
  };

  return {
    uploadFile,
    setUploadFile,
    uploadLoading,
    uploadResult,
    setUploadResult,
    uploadError,
    setUploadError,
    uploadDuplicate,
    existingCandidate,
    fileInputRef,
    reviewIngestion,
    reviewForm,
    reviewLoading,
    reviewSaved,
    convertLoading,
    duplicateInfo,
    resolveLoading,
    convertSuccess,
    reviewError,
    // handlers
    openUploadModal,
    closeUploadModal,
    openReviewModal,
    closeReviewModal,
    setReviewField,
    updateEducation,
    addEducation,
    removeEducation,
    handleFileSelect,
    startPolling,
    handleUploadSubmit,
    handleSaveReview,
    handleConvert,
    handleResolveDuplicate,
  };
}
