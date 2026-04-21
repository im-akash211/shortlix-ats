export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  
  // Requisitions
  REQUISITIONS: {
    ROOT: '/requisitions',
    NEW: '/requisitions/new',
    EDIT: (id) => `/requisitions/${id}/edit`,
    EDIT_PATTERN: '/requisitions/:id/edit',
  },

  // Jobs
  JOBS: {
    ROOT: '/jobs',
    DETAIL: (jobId) => `/jobs/${jobId}`,
    DETAIL_PATTERN: '/jobs/:jobId',
    CANDIDATES: (jobId) => `/jobs/${jobId}/candidates`,
    CANDIDATES_PATTERN: '/jobs/:jobId/candidates',
    CANDIDATE_PROFILE: (jobId, candidateId) => `/jobs/${jobId}/candidates/${candidateId}`,
    CANDIDATE_PROFILE_PATTERN: '/jobs/:jobId/candidates/:candidateId',
    INTERVIEWS: (jobId) => `/jobs/${jobId}/interviews`,
    INTERVIEWS_PATTERN: '/jobs/:jobId/interviews',
    NEW_INTERVIEW: (jobId) => `/jobs/${jobId}/interview/new`,
    NEW_INTERVIEW_PATTERN: '/jobs/:jobId/interview/new',
  },

  // Candidates
  CANDIDATES: {
    ROOT: '/candidates',
    DETAIL: (id) => `/candidates/${id}`,
    DETAIL_PATTERN: '/candidates/:candidateId',
    PROFILE: (id) => `/candidates/${id}/profile`,
    PROFILE_PATTERN: '/candidates/:candidateId/profile',
    EDIT: (id) => `/candidates/${id}/edit`,
    EDIT_PATTERN: '/candidates/:candidateId/edit',
  },

  // Approvals & Misc
  APPROVALS: '/approvals',
  INTERVIEWS: '/interviews',
  SETTINGS: '/settings',

  // Employee portal (public — no auth required)
  EMPLOYEE_PORTAL: '/employee',
};
