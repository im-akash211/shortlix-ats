const BASE = '/api/v1';

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
};

// ---- Departments ---- //
export const departments = {
  list: () => request('/departments/'),
  subVerticals: (deptId, parentParam) => {
    const qs = parentParam !== undefined ? `?parent=${parentParam}` : '';
    return request(`/departments/${deptId}/sub-verticals/${qs}`);
  },
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
  assignJob: (id, jobId) =>
    request(`/candidates/${id}/assign-job/`, { method: 'POST', body: JSON.stringify({ job_id: jobId }) }),
  changeStage: (id, jobId, stage, notes = '') =>
    request(`/candidates/${id}/jobs/${jobId}/stage/`, {
      method: 'PATCH', body: JSON.stringify({ stage, notes }),
    }),
  moveJob: (id, fromJobId, toJobId) =>
    request(`/candidates/${id}/move-job/`, {
      method: 'POST', body: JSON.stringify({ from_job_id: fromJobId, to_job_id: toJobId }),
    }),
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
};
