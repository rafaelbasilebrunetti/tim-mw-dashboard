const BASE_URL = "http://localhost:8000/api";

async function handle(res) {
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.detail || `Erro ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  login: (password) =>
    fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).then(handle),
  logout: () =>
    fetch(`${BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).then(handle),
  checkAuth: () =>
    fetch(`${BASE_URL}/auth/me`, { credentials: "include" }).then(handle),
  changePassword: (currentPassword, newPassword) =>
    fetch(`${BASE_URL}/auth/change-password`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }).then(handle),

  getSchema: () => fetch(`${BASE_URL}/schema`, { credentials: "include" }).then(handle),
  getLinks: () => fetch(`${BASE_URL}/links`, { credentials: "include" }).then(handle),
  getLink: (id) => fetch(`${BASE_URL}/links/${id}`, { credentials: "include" }).then(handle),
  createLink: (payload) =>
    fetch(`${BASE_URL}/links`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle),
  updateLink: (id, payload) =>
    fetch(`${BASE_URL}/links/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle),
  deleteLink: (id) =>
    fetch(`${BASE_URL}/links/${id}`, {
      method: "DELETE",
      credentials: "include",
    }).then(handle),
};
