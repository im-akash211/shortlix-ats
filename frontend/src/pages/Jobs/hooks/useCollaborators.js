import { useState } from 'react';
import { jobsApi, usersApi } from '../services/jobsApi';

export function useCollaborators({ viewingJob, setJobDetail }) {
  const [isCollabModalOpen, setIsCollabModalOpen]       = useState(false);
  const [selectedJob, setSelectedJob]                   = useState(null);
  const [collabList, setCollabList]                     = useState([]);
  const [collabLoading, setCollabLoading]               = useState(false);
  const [collabEmail, setCollabEmail]                   = useState('');
  const [collabSearchResults, setCollabSearchResults]   = useState([]);
  const [collabSearchLoading, setCollabSearchLoading]   = useState(false);
  const [collabActionLoading, setCollabActionLoading]   = useState(false);
  const [collabError, setCollabError]                   = useState('');
  const [recruiterUsers, setRecruiterUsers]             = useState([]);
  const [collabFilter, setCollabFilter]                 = useState('');
  const [collabInputFocused, setCollabInputFocused]     = useState(false);
  const [collabSuccess, setCollabSuccess]               = useState('');

  const openCollabModal = (job) => {
    setSelectedJob(job);
    setCollabError('');
    setCollabSuccess('');
    setCollabEmail('');
    setCollabFilter('');
    setCollabInputFocused(false);
    setCollabSearchResults([]);
    setIsCollabModalOpen(true);
    fetchCollaborators(job.id);
    usersApi.list({ role: 'recruiter' })
      .then((res) => setRecruiterUsers(res.results || res))
      .catch(console.error);
  };

  const fetchCollaborators = (jobId) => {
    setCollabLoading(true);
    jobsApi.listCollaborators(jobId)
      .then((res) => setCollabList(res.results || res))
      .catch(console.error)
      .finally(() => setCollabLoading(false));
  };

  const handleCollabSearch = () => {
    if (!collabEmail.trim()) return;
    setCollabSearchLoading(true);
    setCollabError('');
    usersApi.lookup({ email: collabEmail.trim() })
      .then((res) => setCollabSearchResults(res.results || res))
      .catch(console.error)
      .finally(() => setCollabSearchLoading(false));
  };

  const handleAddCollab = async (userId) => {
    setCollabActionLoading(true);
    setCollabError('');
    setCollabSuccess('');
    try {
      await jobsApi.addCollaborator(selectedJob.id, userId);
      setCollabSearchResults([]);
      setCollabEmail('');
      setCollabFilter('');
      fetchCollaborators(selectedJob.id);
      if (viewingJob?.id === selectedJob.id) {
        jobsApi.detail(selectedJob.id).then(setJobDetail).catch(console.error);
      }
      setCollabSuccess('Collaborator added successfully.');
      setTimeout(() => setCollabSuccess(''), 3000);
    } catch (err) {
      setCollabError(err.data?.non_field_errors?.[0] || err.data?.detail || 'Could not add collaborator.');
    } finally {
      setCollabActionLoading(false);
    }
  };

  const handleRemoveCollab = async (userId) => {
    setCollabActionLoading(true);
    setCollabError('');
    try {
      await jobsApi.removeCollaborator(selectedJob.id, userId);
      fetchCollaborators(selectedJob.id);
      if (viewingJob?.id === selectedJob.id) {
        jobsApi.detail(selectedJob.id).then(setJobDetail).catch(console.error);
      }
    } catch (err) {
      setCollabError(err.data?.detail || 'Could not remove collaborator.');
    } finally {
      setCollabActionLoading(false);
    }
  };

  return {
    isCollabModalOpen, setIsCollabModalOpen,
    selectedJob, setSelectedJob,
    collabList,
    collabLoading,
    collabEmail, setCollabEmail,
    collabSearchResults,
    collabSearchLoading,
    collabActionLoading,
    collabError,
    collabSuccess,
    recruiterUsers,
    collabFilter, setCollabFilter,
    collabInputFocused, setCollabInputFocused,
    openCollabModal,
    fetchCollaborators,
    handleCollabSearch,
    handleAddCollab,
    handleRemoveCollab,
  };
}
