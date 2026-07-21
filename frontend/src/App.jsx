import { useEffect, useState } from "react";
import { api } from "./api";
import StatusOverview from "./components/StatusOverview";
import LinksTable from "./components/LinksTable";
import LinkFormModal from "./components/LinkFormModal";
import LoginPage from "./components/LoginPage";
import ChangePasswordModal from "./components/ChangePasswordModal";
import SiteDetailModal from "./components/SiteDetailModal";
import QuickAddModal from "./components/QuickAddModal";
import ImportModal from "./components/ImportModal";
import StageTransitionModal from "./components/StageTransitionModal";

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [schema, setSchema] = useState([]);
  const [stageFlow, setStageFlow] = useState(null);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalRecord, setModalRecord] = useState(null); // null = fechado, {...} = editar
  const [search, setSearch] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [selectedLink, setSelectedLink] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [transitionRecord, setTransitionRecord] = useState(null); // null = fechado, {...} = mudar etapa

  useEffect(() => {
    api
      .checkAuth()
      .then((res) => setAuthenticated(res.authenticated))
      .catch(() => setAuthenticated(false))
      .finally(() => setAuthChecked(true));
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [schemaRes, linksRes, stageFlowRes] = await Promise.all([
        api.getSchema(),
        api.getLinks(),
        api.getStageFlow(),
      ]);
      setSchema(schemaRes);
      setLinks(linksRes);
      setStageFlow(stageFlowRes);
    } catch (err) {
      if (err.status === 401) {
        setAuthenticated(false);
        return;
      }
      setError(
        "Não foi possível conectar à API em http://localhost:8000. Verifique se o backend está rodando (python app.py)."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authenticated) loadAll();
  }, [authenticated]);

  async function handleSave(payload) {
    if (modalRecord?.id) {
      await api.updateLink(modalRecord.id, payload);
    } else {
      await api.createLink(payload);
    }
    setModalRecord(null);
    await loadAll();
  }

  async function handleDelete(id) {
    if (!confirm("Excluir este link permanentemente?")) return;
    await api.deleteLink(id);
    await loadAll();
  }

  async function handleTransition(payload) {
    const updated = await api.transitionLink(transitionRecord.id, payload);
    setTransitionRecord(null);
    setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setSelectedLink((prev) => (prev && prev.id === updated.id ? updated : prev));
  }

  async function handleQuickAdd(payload) {
    await api.createLink(payload);
    setShowQuickAdd(false);
    await loadAll();
  }

  async function handleLogout() {
    await api.logout().catch(() => {});
    setAuthenticated(false);
  }

  if (!authChecked) {
    return <div className="min-h-screen bg-base" />;
  }

  if (!authenticated) {
    return <LoginPage onAuthenticated={() => setAuthenticated(true)} />;
  }

  const filtered = links.filter((link) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return ["tim_key", "hop", "site_a", "site_b", "oc"].some((f) =>
      String(link[f] || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-base text-ink">
      <header className="border-b border-line bg-surface/60 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="font-mono text-[15px] tracking-tight text-ink">
              TIM MW <span className="text-accent">·</span> SP Preliminary Report
            </h1>
            <p className="text-[12px] text-muted">Painel de acompanhamento de links de microondas</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuickAdd(true)}
              className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-base"
            >
              + Adicionar Site
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="rounded-md border border-line px-3.5 py-1.5 text-[13px] font-medium text-muted hover:text-ink"
            >
              Importar Dados
            </button>
            <button
              onClick={() => setShowChangePassword(true)}
              className="rounded-md border border-line px-3.5 py-1.5 text-[13px] font-medium text-muted hover:text-ink"
            >
              Trocar senha
            </button>
            <button
              onClick={handleLogout}
              className="rounded-md border border-line px-3.5 py-1.5 text-[13px] font-medium text-muted hover:text-ink"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {error && (
          <div className="mb-5 rounded-lg border border-status-hold/40 bg-status-hold/10 px-4 py-3 text-[13px] text-status-hold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-muted">Carregando...</div>
        ) : (
          <>
            <StatusOverview links={links} />

            <div className="mt-6 mb-3 flex items-center justify-between">
              <input
                type="text"
                placeholder="Buscar por TIM Key, HOP, Site..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-xs rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
              />
              <span className="text-[12px] text-muted">
                {filtered.length} de {links.length} link(s)
              </span>
            </div>

            <LinksTable
              schema={schema}
              links={filtered}
              onSelect={(link) => setSelectedLink(link)}
              onEdit={(link) => setModalRecord(link)}
              onDelete={handleDelete}
            />
          </>
        )}
      </main>

      {modalRecord && (
        <LinkFormModal
          schema={schema}
          initialData={modalRecord}
          onSave={handleSave}
          onClose={() => setModalRecord(null)}
        />
      )}

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      {selectedLink && (
        <SiteDetailModal
          schema={schema}
          link={selectedLink}
          onEdit={(link) => {
            setSelectedLink(null);
            setModalRecord(link);
          }}
          onTransition={(link) => setTransitionRecord(link)}
          onClose={() => setSelectedLink(null)}
          onEnriched={(updated) =>
            setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
          }
        />
      )}

      {transitionRecord && stageFlow && (
        <StageTransitionModal
          stageFlow={stageFlow}
          link={transitionRecord}
          onTransition={handleTransition}
          onClose={() => setTransitionRecord(null)}
        />
      )}

      {showQuickAdd && (
        <QuickAddModal schema={schema} onSave={handleQuickAdd} onClose={() => setShowQuickAdd(false)} />
      )}

      {showImport && (
        <ImportModal onImported={loadAll} onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
