const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getToken = () => localStorage.getItem('ccj_token');

const headers = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

const handleResponse = async (res) => {
  if (res.status === 401 && !res.url.includes('/auth/login')) {
    localStorage.removeItem('ccj_token');
    localStorage.removeItem('ccj_user');
    window.location.href = '/';
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
};

export const api = {
  get: (path) =>
    fetch(`${BASE_URL}${path}`, { headers: headers() }).then(handleResponse),

  post: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  postMultipart: (path, formData) => {
    const h = { ...headers() };
    delete h['Content-Type'];
    return fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: h,
      body: formData,
    }).then(handleResponse);
  },

  put: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  putMultipart: (path, formData) => {
    const h = { ...headers() };
    delete h['Content-Type'];
    return fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: h,
      body: formData,
    }).then(handleResponse);
  },

  delete: (path) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: headers(),
    }).then(handleResponse),
};

// ─── Auth ────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
};

// ─── Contracts ───────────────────────────────────────────────
export const contractsApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/contracts${qs ? '?' + qs : ''}`);
  },
  getById: (id) => api.get(`/contracts/${id}`),
  getStats: () => api.get('/contracts/stats'),
  getExpiring: (days = 90) => api.get(`/contracts/expiring?days=${days}`),
  create: (data) => {
    if (data instanceof FormData) return api.postMultipart('/contracts', data);
    return api.post('/contracts', data);
  },
  update: (id, data) => {
    if (data instanceof FormData) return api.putMultipart(`/contracts/${id}`, data);
    return api.put(`/contracts/${id}`, data);
  },
  renew: (id, data) => api.post(`/contracts/${id}/renew`, data),
  delete: (id) => api.delete(`/contracts/${id}`),
};

// ─── Vendors ─────────────────────────────────────────────────
export const vendorsApi = {
  getAll: () => api.get('/vendors'),
  getById: (id) => api.get(`/vendors/${id}`),
  create: (data) => api.post('/vendors', data),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  delete: (id) => api.delete(`/vendors/${id}`),
};

// ─── Users ───────────────────────────────────────────────────
export const usersApi = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  deactivate: (id) => api.delete(`/users/${id}`),
};

// ─── Notifications ───────────────────────────────────────────
export const notificationsApi = {
  getLog: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/notifications${qs ? '?' + qs : ''}`);
  },
  triggerCheck: () => api.post('/notifications/run', {}),
};

// ─── Audit Log ───────────────────────────────────────────────
export const auditApi = {
  getLog: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/audit-log${qs ? '?' + qs : ''}`);
  },
};

// ─── Settings ────────────────────────────────────────────────
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (settings) => api.post('/settings', { settings }),
};
