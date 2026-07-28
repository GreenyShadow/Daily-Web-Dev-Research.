const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const api = {
  // Auth
  login: (username, password) => request('/login', { method: 'POST', body: { username, password } }),
  logout: (token) => request('/logout', { method: 'POST', token }),

  // Users
  listUsers: (token) => request('/users', { token }),
  createUser: (token, user) => request('/users', { method: 'POST', body: user, token }),
  updateUser: (token, username, updates) =>
    request(`/users/${encodeURIComponent(username)}`, { method: 'PATCH', body: updates, token }),
  deleteUser: (token, username) =>
    request(`/users/${encodeURIComponent(username)}`, { method: 'DELETE', token }),
  listAgents: (token) => request('/agents', { token }),

  // Tickets
  listTickets: (token) => request('/tickets', { token }),
  getTicket: (token, id) => request(`/tickets/${id}`, { token }),
  createTicket: (token, ticket) => request('/tickets', { method: 'POST', body: ticket, token }),
  updateTicket: (token, id, updates) => request(`/tickets/${id}`, { method: 'PATCH', body: updates, token }),
  deleteTicket: (token, id) => request(`/tickets/${id}`, { method: 'DELETE', token }),
  claimTicket: (token, id) => request(`/tickets/${id}/claim`, { method: 'POST', token }),
  releaseTicket: (token, id) => request(`/tickets/${id}/release`, { method: 'POST', token }),
  reassignTicket: (token, id, to) => request(`/tickets/${id}/reassign`, { method: 'POST', body: { to }, token }),
  addComment: (token, id, text) => request(`/tickets/${id}/comments`, { method: 'POST', body: { text }, token }),
};

export { ApiError, API_BASE };
