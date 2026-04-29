import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '../services/jobsApi';

export function useJobDetail({ setViewingJob }) {
  const queryClient = useQueryClient();

  const [jobDetail, setJobDetail]                   = useState(null);
  const [jobDetailLoading, setJobDetailLoading]     = useState(false);
  const [editForm, setEditForm]                     = useState({});
  const [editLoading, setEditLoading]               = useState(false);
  const [isEditOpen, setIsEditOpen]                 = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isDeleteJobOpen, setIsDeleteJobOpen]       = useState(false);
  const [deleteJobLoading, setDeleteJobLoading]     = useState(false);

  const openEdit = () => {
    if (!jobDetail) return;
    setEditForm({
      // Core
      title:             jobDetail.title || '',
      department:        jobDetail.department || '',
      hiring_manager:    jobDetail.hiring_manager || '',
      location:          jobDetail.location || '',
      status:            jobDetail.status || 'open',
      // Sub-verticals
      sub_vertical_1:    jobDetail.sub_vertical_1 || null,
      sub_vertical_2:    jobDetail.sub_vertical_2 || null,
      // Role details
      designation:       jobDetail.designation || '',
      priority:          jobDetail.priority || 'medium',
      employment_type:   jobDetail.employment_type || 'permanent',
      requisition_type:  jobDetail.requisition_type || 'new',
      work_mode:         jobDetail.work_mode || '',
      // Headcount & experience
      positions_count:   jobDetail.positions_count ?? 1,
      experience_min:    jobDetail.experience_min ?? 0,
      experience_max:    jobDetail.experience_max ?? 0,
      // Skills & qualifications
      skills_required:   jobDetail.skills_required || [],
      skills_desirable:  jobDetail.skills_desirable || [],
      min_qualification: jobDetail.min_qualification || '',
      // Project / client
      project_name:      jobDetail.project_name || '',
      client_name:       jobDetail.client_name || '',
      // Planning
      expected_start_date: jobDetail.expected_start_date || null,
      tat_days:          jobDetail.tat_days || null,
      budget_min:        jobDetail.budget_min || null,
      budget_max:        jobDetail.budget_max || null,
      // Candidate signals
      iit_grad:             jobDetail.iit_grad || false,
      nit_grad:             jobDetail.nit_grad || false,
      iim_grad:             jobDetail.iim_grad || false,
      top_institute:        jobDetail.top_institute || false,
      unicorn_exp:          jobDetail.unicorn_exp || false,
      top_internet_product: jobDetail.top_internet_product || false,
      top_software_product: jobDetail.top_software_product || false,
      top_it_services_mnc:  jobDetail.top_it_services_mnc || false,
      top_consulting_mnc:   jobDetail.top_consulting_mnc || false,
      // JD
      job_description:   jobDetail.job_description || '',
    });
    setIsEditOpen(true);
  };

  const handleEditSave = async () => {
    setEditLoading(true);
    try {
      const payload = {
        ...editForm,
        experience_min:  Number(editForm.experience_min),
        experience_max:  Number(editForm.experience_max),
        positions_count: Number(editForm.positions_count) || 1,
        tat_days:        editForm.tat_days ? Number(editForm.tat_days) : null,
        budget_min:      editForm.budget_min ? String(editForm.budget_min) : null,
        budget_max:      editForm.budget_max ? String(editForm.budget_max) : null,
        sub_vertical_1:  editForm.sub_vertical_1 || null,
        sub_vertical_2:  editForm.sub_vertical_2 || null,
        expected_start_date: editForm.expected_start_date || null,
        // Skills stay as arrays (TagInput already handles that)
        skills_required:  Array.isArray(editForm.skills_required) ? editForm.skills_required : [],
        skills_desirable: Array.isArray(editForm.skills_desirable) ? editForm.skills_desirable : [],
      };

      const updated = await jobsApi.update(jobDetail.id, payload);
      setJobDetail(updated);
      setViewingJob((prev) => ({
        ...prev,
        title: updated.title,
        location: updated.location,
        status: updated.status,
      }));
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
