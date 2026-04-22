import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '../services/jobsApi';

export function useJobDetail({ setViewingJob }) {
  const queryClient = useQueryClient();

  const [jobDetail, setJobDetail]           = useState(null);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);
  const [editForm, setEditForm]             = useState({});
  const [editLoading, setEditLoading]       = useState(false);
  const [isEditOpen, setIsEditOpen]         = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isDeleteJobOpen, setIsDeleteJobOpen] = useState(false);
  const [deleteJobLoading, setDeleteJobLoading] = useState(false);

  const openEdit = () => {
    if (!jobDetail) return;
    setEditForm({
      title:            jobDetail.title || '',
      location:         jobDetail.location || '',
      status:           jobDetail.status || 'open',
      experience_min:   jobDetail.experience_min ?? 0,
      experience_max:   jobDetail.experience_max ?? 0,
      skills_required:  (jobDetail.skills_required || []).join(', '),
      job_description:  jobDetail.job_description || '',
    });
    setIsEditOpen(true);
  };

  const handleEditSave = async () => {
    setEditLoading(true);
    try {
      const updated = await jobsApi.update(jobDetail.id, {
        ...editForm,
        skills_required: editForm.skills_required.split(',').map((s) => s.trim()).filter(Boolean),
        experience_min:  Number(editForm.experience_min),
        experience_max:  Number(editForm.experience_max),
      });
      setJobDetail(updated);
      setViewingJob((prev) => ({ ...prev, title: updated.title, location: updated.location, status: updated.status }));
      setIsEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['jobs', 'list'] });
    } catch (err) {
      alert(err.data?.detail || JSON.stringify(err.data) || 'Failed to save changes');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!jobDetail) return;
    setDeleteJobLoading(true);
    try {
      await jobsApi.delete(jobDetail.id);
      setIsDeleteJobOpen(false);
      setViewingJob(null);
      setJobDetail(null);
      queryClient.invalidateQueries({ queryKey: ['jobs', 'list'] });
    } catch (err) {
      alert(err.data?.detail || 'Failed to delete job');
    } finally {
      setDeleteJobLoading(false);
    }
  };

  return {
    jobDetail, setJobDetail,
    jobDetailLoading, setJobDetailLoading,
    editForm, setEditForm,
    editLoading,
    isEditOpen, setIsEditOpen,
    isCloseConfirmOpen, setIsCloseConfirmOpen,
    isDeleteJobOpen, setIsDeleteJobOpen,
    deleteJobLoading,
    openEdit,
    handleEditSave,
    handleDeleteJob,
  };
}
