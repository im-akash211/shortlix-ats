const BASE = (import.meta.env.VITE_API_URL || '') + '/api/v1';

function getAccess() {
  return localStorage.getItem('access');
}

function getRefresh() {
  return localStorage.getItem('refresh');
}

function saveTokens({ access, refresh }) {
  if (access) localStorage.setItem('access', access);
  if (refresh) localStorage.setItem('refresh', refresh);
}

export function clearAuth() {
  localStorage.removeItem('access');
  localStorage.removeItem('refresh');
  localStorage.removeItem('user');
}

async function refreshAccessToken() {
  const refresh = getRefresh();
  if (!refresh) return null;
  const res = await fetch(`${BASE}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    clearAuth();
    return null;
  }
  const data = await res.json();
  saveTokens(data);
  return data.access;
}

async function request(path, options = {}, retry = true) {
  const token = getAccess();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      window.dispatchEvent(new Event('auth:logout'));
      throw new Error('Session expired');
    }
    return request(path, options, false);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw Object.assign(new Error(err.detail || JSON.stringify(err)), { status: res.status, data: err });
  }

  if (res.status === 204) return null;
  return res.json();
}

// ---- Auth ---- //
export const auth = {
  login: (email, password) =>
    request('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    request('/auth/logout/', {
      method: 'POST',
      body: JSON.stringify({ refresh: getRefresh() }),
    }),
  me: () => request('/auth/me/'),
  changePassword: (oldPassword, newPassword) =>
    request('/auth/change-password/', {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    }),
  saveSession: ({ access, refresh, user }) => {
    saveTokens({ access, refresh });
    if (user) localStorage.setItem('user', JSON.stringify(user));
  },
  getUser: () => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  },
};

// ---- Dashboard ---- //
export const dashboard = {
  summary: (params = {}) => request('/dashboard/summary/?' + new URLSearchParams(params)),
  funnel: (params = {}) => request('/dashboard/funnel/?' + new URLSearchParams(params)),
  pendingActions: () => request('/dashboard/pending-actions/'),
  filterOptions: () => request('/dashboard/filter-options/'),
  reportExcelUrl: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return `${BASE}/dashboard/report/excel/${qs ? '?' + qs : ''}`;
  },
};

// ---- Departments ---- //
export const departments = {
  list: () => request('/departments/'),
  create: (data) => request('/departments/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/departments/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id) => request(`/departments/${id}/`, { method: 'DELETE' }),
  subVerticals: (deptId, parentParam) => {
    const qs = parentParam !== undefined ? `?parent=${parentParam}` : '';
    return request(`/departments/${deptId}/sub-verticals/${qs}`);
  },
};

// ---- Roles ---- //
export const roles = {
  list: () => request('/roles/'),
  updatePermissions: (id, permissionKeys) =>
    request(`/roles/${id}/permissions/`, {
      method: 'PATCH',
      body: JSON.stringify({ permission_keys: permissionKeys }),
    }),
};

// ---- Requisitions ---- //
export const requisitions = {
  list: (params = {}) => request('/requisitions/?' + new URLSearchParams(params)),
  detail: (id) => request(`/requisitions/${id}/`),
  create: (data) => request('/requisitions/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/requisitions/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  submit: (id, comments = '') =>
    request(`/requisitions/${id}/submit/`, { method: 'POST', body: JSON.stringify({ comments }) }),
  approve: (id, comments = '') =>
    request(`/requisitions/${id}/approve/`, { method: 'POST', body: JSON.stringify({ comments }) }),
  reject: (id, comments = '') =>
    request(`/requisitions/${id}/reject/`, { method: 'POST', body: JSON.stringify({ comments }) }),
  delete: (id) => request(`/requisitions/${id}/delete/`, { method: 'DELETE' }),
};

// ---- Jobs ---- //
export const jobs = {
  list: (params = {}) => request('/jobs/?' + new URLSearchParams(params)),
  detail: (id) => request(`/jobs/${id}/`),
  pipeline: (id, params = {}) => request(`/jobs/${id}/pipeline/?` + new URLSearchParams(params)),
  pipelineStats: (id) => request(`/jobs/${id}/pipeline/stats/`),
  update: (id, data) => request(`/jobs/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  listCollaborators: (id) => request(`/jobs/${id}/collaborators/`),
  addCollaborator: (id, userId) =>
    request(`/jobs/${id}/collaborators/`, { method: 'POST', body: JSON.stringify({ user: userId }) }),
  removeCollaborator: (id, userId) =>
    request(`/jobs/${id}/collaborators/${userId}/`, { method: 'DELETE' }),
  delete: (id) => request(`/jobs/${id}/delete/`, { method: 'DELETE' }),
  history: (id) => request(`/jobs/${id}/history/`),
  reportExcelUrl: (id) => `${BASE}/jobs/${id}/report/excel/`,
};

// ---- Candidates ---- //
export const candidates = {
  list: (params = {}) => request('/candidates/?' + new URLSearchParams(params)),
  detail: (id) => request(`/candidates/${id}/`),
  create: (data) => request('/candidates/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/candidates/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  notes: (id) => request(`/candidates/${id}/notes/`),
  addNote: (id, content) =>
    request(`/candidates/${id}/notes/`, { method: 'POST', body: JSON.stringify({ content }) }),
  editNote: (candidateId, noteId, content) =>
    request(`/candidates/${candidateId}/notes/${noteId}/`, { method: 'PATCH', body: JSON.stringify({ content }) }),
  deleteNote: (candidateId, noteId) =>
    request(`/candidates/${candidateId}/notes/${noteId}/`, { method: 'DELETE' }),
  assignJob: (id, jobId) =>
    request(`/candidates/${id}/assign-job/`, { method: 'POST', body: JSON.stringify({ job_id: jobId }) }),
  changeStage: (id, jobId, payload) =>
    request(`/candidates/${id}/jobs/${jobId}/stage/`, {
      method: 'PATCH', body: JSON.stringify(payload),
    }),
  nextRound: (id, jobId, data = {}) =>
    request(`/candidates/${id}/jobs/${jobId}/interview/next-round/`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  jumpToRound: (id, jobId, roundName) =>
    request(`/candidates/${id}/jobs/${jobId}/interview/jump-round/`, {
      method: 'POST', body: JSON.stringify({ round_name: roundName }),
    }),
  setScreeningStatus: (candidateId, jobId, screeningStatus) =>
    request(`/candidates/${candidateId}/jobs/${jobId}/screening-status/`, {
      method: 'PATCH',
      body: JSON.stringify({ screening_status: screeningStatus }),
    }),
  moveJob: (id, fromJobId, toJobId) =>
    request(`/candidates/${id}/move-job/`, {
      method: 'POST',
      body: JSON.stringify(
        fromJobId
          ? { from_job_id: fromJobId, to_job_id: toJobId }
          : { to_job_id: toJobId }
      ),
    }),
  delete: (id) => request(`/candidates/${id}/delete/`, { method: 'DELETE' }),
  getComments: (candidateId, jobId) =>
    request(`/candidates/${candidateId}/jobs/${jobId}/comments/`),
  addComment: (candidateId, jobId, content) =>
    request(`/candidates/${candidateId}/jobs/${jobId}/comments/`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  reminders: (id) => request(`/candidates/${id}/reminders/`),
  addReminder: (id, data) =>
    request(`/candidates/${id}/reminders/`, { method: 'POST', body: JSON.stringify(data) }),
  updateReminder: (id, reminderId, data) =>
    request(`/candidates/${id}/reminders/${reminderId}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteReminder: (id, reminderId) =>
    request(`/candidates/${id}/reminders/${reminderId}/`, { method: 'DELETE' }),
  uploadResume: (id, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return requestUpload(`/candidates/${id}/resume/`, fd);
  },
  getAIMatch: (id) => request(`/candidates/${id}/ai-match/`),
  computeAIMatch: (id) =>
    request(`/candidates/${id}/ai-match/`, { method: 'POST' }),
};

// ---- Interviews ---- //
export const interviews = {
  list: (params = {}) => request('/interviews/?' + new URLSearchParams(params)),
  summary: () => request('/interviews/summary/'),
  detail: (id) => request(`/interviews/${id}/`),
  create: (data) => request('/interviews/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/interviews/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  cancel: (id) => request(`/interviews/${id}/cancel/`, { method: 'POST' }),
  submitFeedback: (id, data) =>
    request(`/interviews/${id}/feedback/`, { method: 'POST', body: JSON.stringify(data) }),
  getFeedback: (id) => request(`/interviews/${id}/feedback/detail/`),
  updateFeedback: (id, data) =>
    request(`/interviews/${id}/feedback/detail/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFeedback: (id) =>
    request(`/interviews/${id}/feedback/detail/`, { method: 'DELETE' }),
  setRoundResult: (id, roundResult) =>
    request(`/interviews/${id}/round-result/`, {
      method: 'PATCH', body: JSON.stringify({ round_result: roundResult }),
    }),
  setRoundStatus: (id, roundStatus) =>
    request(`/interviews/${id}/round-status/`, {
      method: 'PATCH', body: JSON.stringify({ round_status: roundStatus }),
    }),
};

// ---- Resumes ---- //
// File uploads must NOT set Content-Type (browser sets multipart/form-data + boundary)
async function requestUpload(path, formData, retry = true) {
  const token = getAccess();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      window.dispatchEvent(new Event('auth:logout'));
      throw new Error('Session expired');
    }
    return requestUpload(path, formData, false);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw Object.assign(new Error(err.detail || JSON.stringify(err)), { status: res.status, data: err });
  }

  return res.json();
}

export const resumes = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestUpload('/resume/upload/', formData);
  },
  status: (id) => request(`/resume/${id}/status/`),
  list: () => request('/resume/'),
  review: (id, data) => request(`/resume/${id}/review/`, { method: 'PATCH', body: JSON.stringify(data) }),
  convert: (id) => request(`/resume/${id}/convert/`, { method: 'POST' }),
  discard: (id) => request(`/resume/${id}/discard/`, { method: 'DELETE' }),
  resolveDuplicate: (id, decision) =>
    request(`/resume/${id}/resolve-duplicate/`, { method: 'POST', body: JSON.stringify({ decision }) }),
};

// ---- AI ---- //
export const ai = {
  generateRequisitionContent: (data) =>
    request('/requisitions/ai/generate/', { method: 'POST', body: JSON.stringify(data) }),
};

// ---- Reminders ---- //
export const remindersApi = {
  create: (candidateId, data) =>
    request(`/candidates/${candidateId}/reminders/`, { method: 'POST', body: JSON.stringify(data) }),
  list: (candidateId) => request(`/candidates/${candidateId}/reminders/`),
  delete: (candidateId, reminderId) =>
    request(`/candidates/${candidateId}/reminders/${reminderId}/`, { method: 'DELETE' }),
  markDone: (candidateId, reminderId) =>
    request(`/candidates/${candidateId}/reminders/${reminderId}/`, { method: 'PATCH', body: JSON.stringify({ is_done: true }) }),
};

// ---- Notifications ---- //
export const notifications = {
  list: () => request('/notifications/'),
  markRead: (id) => request(`/notifications/${id}/read/`, { method: 'PATCH' }),
  markAllRead: () => request('/notifications/mark-all-read/', { method: 'POST' }),
  delete: (id) => request(`/notifications/${id}/delete/`, { method: 'DELETE' }),
  deleteAll: () => request('/notifications/delete-all/', { method: 'DELETE' }),
};

// ---- Employee Portal (public — no auth) ---- //
async function publicRequest(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw Object.assign(new Error(err.detail || JSON.stringify(err)), { status: res.status, data: err });
  }
  return res.json();
}

async function publicUpload(path, formData) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw Object.assign(new Error(err.detail || JSON.stringify(err)), { status: res.status, data: err });
  }
  return res.json();
}

export const employee = {
  jobs: () => publicRequest('/employee/jobs/'),
  refer: (formData) => publicUpload('/employee/refer/', formData),
};

// ---- Candidates Share ---- //
export const candidateShare = {
  share: (candidateId, userIds) =>
    request(`/candidates/${candidateId}/share/`, {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds }),
    }),
};

// ---- Referrals (Admin) ---- //
export const referrals = {
  list: (status = 'pending') => request(`/candidates/referrals/?status=${status}`),
  approve: (id) => request(`/candidates/referrals/${id}/approve/`, { method: 'POST' }),
  decline: (id) => request(`/candidates/referrals/${id}/decline/`, { method: 'POST' }),
};

// ---- Users (Admin) ---- //
export const users = {
  dropdown: () => request('/users/dropdown/'),
  list: (params = {}) => request('/users/?' + new URLSearchParams(params)),
  lookup: (params = {}) => request('/users/lookup/?' + new URLSearchParams(params)),
  detail: (id) => request(`/users/${id}/`),
  create: (data) => request('/users/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/users/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  activate: (id) => request(`/users/${id}/activate/`, { method: 'POST' }),
  deactivate: (id) => request(`/users/${id}/deactivate/`, { method: 'POST' }),
  changeRole: (id, role) =>
    request(`/users/${id}/role/`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  changeStatus: (id, status) =>
    request(`/users/${id}/status/`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  remove: (id) => request(`/users/${id}/remove/`, { method: 'DELETE' }),
  adminChangePassword: (id, newPassword) =>
    request(`/users/${id}/password/`, { method: 'PATCH', body: JSON.stringify({ new_password: newPassword }) }),
};
