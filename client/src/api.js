const BASE = '/api';

function safeGetItem(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key, value) {
  try { localStorage.setItem(key, value); } catch { /* quota or disabled */ }
}

function safeRemoveItem(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function getHeaders() {
  const token = safeGetItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: getHeaders(),
    ...options
  });

  if (res.status === 401 && !path.includes('/auth/')) {
    safeRemoveItem('token');
    safeRemoveItem('activeWorkspace');
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Invalid server response');
  }

  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const auth = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me')
};

export const workspaces = {
  list: () => request('/workspaces'),
  create: (name) => request('/workspaces', { method: 'POST', body: JSON.stringify({ name }) }),
  remove: (id) => request(`/workspaces/${id}`, { method: 'DELETE' })
};

export const documents = {
  list: (wsId) => request(`/documents/${wsId}`),
  upload: async (wsId, file) => {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File too large. Maximum size is 10MB.');
    }
    const formData = new FormData();
    formData.append('file', file);
    const token = safeGetItem('token');
    const res = await fetch(`${BASE}/documents/${wsId}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    let data;
    try { data = await res.json(); } catch { throw new Error('Upload failed - invalid response'); }
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },
  remove: (wsId, docId) => request(`/documents/${wsId}/${docId}`, { method: 'DELETE' })
};

export const chat = {
  send: (wsId, message) => request(`/chat/${wsId}/send`, { method: 'POST', body: JSON.stringify({ message }) }),
  history: (wsId) => request(`/chat/${wsId}/history`),
  clearHistory: (wsId) => request(`/chat/${wsId}/history`, { method: 'DELETE' }),
  toolLogs: (wsId) => request(`/chat/${wsId}/tool-logs`),
  tasks: (wsId) => request(`/chat/${wsId}/tasks`)
};

export { safeGetItem, safeSetItem, safeRemoveItem };
