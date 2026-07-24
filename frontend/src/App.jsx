import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { applyFilters, countActiveFilters, emptyFilters } from "./filters";
import StatusOverview from "./components/StatusOverview";
import FilterBar from "./components/FilterBar";
import ExportMenu from "./components/ExportMenu";
import LinksTable from "./components/LinksTable";
import LinkFormModal from "./components/LinkFormModal";
import LoginPage from "./components/LoginPage";
import ChangePasswordModal from "./components/ChangePasswordModal";
import SiteDetailModal from "./components/SiteDetailModal";
import QuickAddModal from "./components/QuickAddModal";
import StageTransitionModal from "./components/StageTransitionModal";
import PipelineModal from "./components/PipelineModal";

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
  const [filters, setFilters] = useState(emptyFilters); // { tim_key: [], hop: [], preliminary_status: [] }
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [selectedLink, setSelectedLink] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [transitionRecord, setTransitionRecord] = useState(null); // null = fechado, {...} = mudar etapa
  const [showPipeline, setShowPipeline] = useState(false);

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

  function handleFilterChange(field, values) {
    setFilters((prev) => ({ ...prev, [field]: values }));
  }

  function handleClearFilters() {
    setFilters(emptyFilters());
    setSearch("");
  }

  const filtered = useMemo(
    () => applyFilters(links, { search, filters }),
    [links, search, filters]
  );

  const filtersActive = countActiveFilters(filters) > 0 || search.trim() !== "";

  if (!authChecked) {
    return <div className="min-h-screen bg-base" />;
  }

  if (!authenticated) {
    return <LoginPage onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-base text-ink">
      <header className="border-b border-line bg-surface/60 px-6 py-4">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4">
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
              onClick={() => setShowPipeline(true)}
              className="rounded-md border border-line px-3.5 py-1.5 text-[13px] font-medium text-muted hover:text-ink"
            >
              Ver fluxograma
            </button>
            <ExportMenu
              schema={schema}
              allLinks={links}
              filteredLinks={filtered}
              filtersActive={filtersActive}
            />
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

      <main className="mx-auto max-w-[1800px] px-6 py-6">
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

            <FilterBar
              links={links}
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearAll={handleClearFilters}
              resultCount={filtered.length}
            />

            <LinksTable
              schema={schema}
              links={filtered}
              filtersActive={filtersActive}
              onClearFilters={handleClearFilters}
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

      {showPipeline && <PipelineModal onClose={() => setShowPipeline(false)} />}

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
    </div>
  );
}
