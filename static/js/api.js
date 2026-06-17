// API client — all fetch calls go through here
const api = (() => {
  const BASE = '';

  function getToken() {
    return localStorage.getItem('token');
  }

  async function request(method, path, body = null, opts = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers };
    if (body !== null) config.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, config);

    if (res.status === 401) {
      auth.logout();
      throw new Error('Unauthorized');
    }

    if (res.status === 204) return null;

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    return data;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    delete: (path) => request('DELETE', path),
    patch: (path, body) => request('PATCH', path, body),

    // Convenience methods
    getMe: () => request('GET', '/auth/me'),
    getStats: () => request('GET', '/api/applications/stats/dashboard'),

    getCompanies: () => request('GET', '/api/companies'),
    createCompany: (data) => request('POST', '/api/companies', data),
    updateCompany: (id, data) => request('PUT', `/api/companies/${id}`, data),
    deleteCompany: (id) => request('DELETE', `/api/companies/${id}`),

    getApplications: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString();
      return request('GET', `/api/applications${qs ? '?' + qs : ''}`);
    },
    createApplication: (data) => request('POST', '/api/applications', data),
    getApplication: (id) => request('GET', `/api/applications/${id}`),
    updateApplication: (id, data) => request('PUT', `/api/applications/${id}`, data),
    deleteApplication: (id) => request('DELETE', `/api/applications/${id}`),

    getInterviews: (appId) => request('GET', `/api/interviews?application_id=${appId}`),
    createInterview: (data) => request('POST', '/api/interviews', data),
    updateInterview: (id, data) => request('PUT', `/api/interviews/${id}`, data),
    deleteInterview: (id) => request('DELETE', `/api/interviews/${id}`),

    getContacts: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString();
      return request('GET', `/api/contacts${qs ? '?' + qs : ''}`);
    },
    createContact: (data) => request('POST', '/api/contacts', data),
    updateContact: (id, data) => request('PUT', `/api/contacts/${id}`, data),
    deleteContact: (id) => request('DELETE', `/api/contacts/${id}`),

    // Admin
    getAdminUsers: () => request('GET', '/api/admin/users'),
    getPendingCount: () => request('GET', '/api/admin/users/pending/count'),
    approveUser: (id) => request('POST', `/api/admin/users/${id}/approve`),
    rejectUser: (id) => request('POST', `/api/admin/users/${id}/reject`),
    toggleUserActive: (id) => request('POST', `/api/admin/users/${id}/toggle-active`),
    deleteAdminUser: (id) => request('DELETE', `/api/admin/users/${id}`),
    getAdminSettings: () => request('GET', '/api/admin/settings'),
    updateAdminSettings: (data) => request('PUT', '/api/admin/settings', data),
    getAdminAgentStats: () => request('GET', '/api/admin/agent-stats'),
    getAdminDiagnostics: () => request('GET', '/api/admin/diagnostics'),
    runDebugSync: () => request('POST', '/api/admin/debug-sync'),

    // Email accounts
    getEmailAccounts: () => request('GET', '/api/email/accounts'),
    getGmailAuthUrl: () => request('GET', '/api/email/auth/gmail'),
    deleteEmailAccount: (id) => request('DELETE', `/api/email/accounts/${id}`),
    triggerEmailSync: () => request('POST', '/api/email/sync'),

    // Agent activity
    getAgentActivity: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString();
      return request('GET', `/api/agent/activity${qs ? '?' + qs : ''}`);
    },
    undoAgentActivity: (id) => request('POST', `/api/agent/activity/${id}/undo`),

    // Push notifications
    getVapidPublicKey: () => request('GET', '/api/push/vapid-public-key'),
    subscribePush: (sub) => request('POST', '/api/push/subscribe', sub),
    unsubscribePush: (endpoint) => request('DELETE', '/api/push/unsubscribe', { endpoint }),
  };
})();
