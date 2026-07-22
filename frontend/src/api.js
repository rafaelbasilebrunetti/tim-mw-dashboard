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
  getStageFlow: () => fetch(`${BASE_URL}/stage-flow`, { credentials: "include" }).then(handle),
  getLinks: () => fetch(`${BASE_URL}/links`, { credentials: "include" }).then(handle),
  getLink: (id) => fetch(`${BASE_URL}/links/${id}`, { credentials: "include" }).then(handle),
  enrichSiteReference: (id) =>
    fetch(`${BASE_URL}/links/${id}/enrich-reference`, { method: "POST", credentials: "include" }).then(handle),
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
  transitionLink: (id, payload) =>
    fetch(`${BASE_URL}/links/${id}/transition`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle),

  // Exportação formatada: o .xlsx é montado no backend a partir do
  // template em config/templates/ (ver export_excel.py), então a resposta
  // é um arquivo binário, não JSON.
  downloadExport: async (ids) => {
    const res = await fetch(`${BASE_URL}/export`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ids || null }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const error = new Error(data?.detail || `Erro ${res.status}`);
      error.status = res.status;
      throw error;
    }

    const disposition = res.headers.get("Content-Disposition") || "";
    const match = /filename="?([^"]+)"?/.exec(disposition);
    return {
      blob: await res.blob(),
      fileName: match ? match[1] : "TIM_MW_SP_Preliminary_Report.xlsx",
    };
  },
};
