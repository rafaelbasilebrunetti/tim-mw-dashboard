import { useRef, useState } from "react";
import { api } from "../api";
import { useDismiss } from "../useDismiss";
import { DATE_FORMATS, exportToCsv, saveBlob } from "../exportData";

/**
 * Botão "Exportar Dados" + painel de opções.
 *
 * Dois formatos:
 *   Excel (.xlsx) — montado no backend sobre o template formatado em
 *     config/templates/, com as cores, larguras, filtro, painéis
 *     congelados e agrupamento de colunas do controle original.
 *   CSV (.csv)    — montado aqui no navegador, só os dados, sem
 *     formatação. Útil para carregar em outra ferramenta.
 *
 * Nos dois casos a ordem e os títulos das colunas saem do schema, ou
 * seja, do mesmo template que define o padrão do dashboard.
 */
export default function ExportMenu({ schema, allLinks, filteredLinks, filtersActive }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState("xlsx");
  const [scope, setScope] = useState("filtered");
  const [dateFormat, setDateFormat] = useState("br");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  useDismiss(containerRef, open, () => setOpen(false));

  // Sem filtro ativo os dois escopos são a mesma coisa: não faz sentido
  // perguntar, então o painel só mostra a escolha quando ela importa.
  const records = filtersActive && scope === "filtered" ? filteredLinks : allLinks;
  const disabled = busy || schema.length === 0 || records.length === 0;

  async function handleDownload() {
    setError(null);

    if (format === "csv") {
      exportToCsv(schema, records, { dateFormat });
      setOpen(false);
      return;
    }

    setBusy(true);
    try {
      const ids = filtersActive && scope === "filtered" ? records.map((l) => l.id) : null;
      const { blob, fileName } = await api.downloadExport(ids);
      saveBlob(blob, fileName);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-md border border-line px-3.5 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
      >
        Exportar Dados
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-80 rounded-lg border border-line bg-surface shadow-2xl">
          <div className="border-b border-line px-4 py-3">
            <h3 className="font-mono text-[13px] text-ink">Exportar dados</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Mesmas colunas, na mesma ordem, do template em{" "}
              <span className="font-mono text-ink">config/templates/</span>.
            </p>
          </div>

          <fieldset className="border-b border-line px-4 py-3">
            <legend className="mb-2 text-[11px] uppercase tracking-wide text-muted">Formato</legend>
            <Radio
              name="format"
              checked={format === "xlsx"}
              onChange={() => setFormat("xlsx")}
              label={
                <>
                  <span className="font-mono">.xlsx</span>
                  <span className="text-muted"> — Excel formatado, no padrão do controle</span>
                </>
              }
            />
            <Radio
              name="format"
              checked={format === "csv"}
              onChange={() => setFormat("csv")}
              label={
                <>
                  <span className="font-mono">.csv</span>
                  <span className="text-muted"> — só os dados, sem formatação</span>
                </>
              }
            />
          </fieldset>

          {filtersActive && (
            <fieldset className="border-b border-line px-4 py-3">
              <legend className="mb-2 text-[11px] uppercase tracking-wide text-muted">
                O que exportar
              </legend>
              <Radio
                name="scope"
                checked={scope === "filtered"}
                onChange={() => setScope("filtered")}
                label={`Apenas os ${filteredLinks.length} link(s) filtrados`}
              />
              <Radio
                name="scope"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                label={`Todos os ${allLinks.length} link(s)`}
              />
            </fieldset>
          )}

          {/* No .xlsx as datas vão como data de verdade e quem manda no
              formato é o Excel; a escolha só existe para o CSV. */}
          {format === "csv" && (
            <fieldset className="border-b border-line px-4 py-3">
              <legend className="mb-2 text-[11px] uppercase tracking-wide text-muted">
                Formato das datas
              </legend>
              {Object.entries(DATE_FORMATS).map(([key, { label, hint }]) => (
                <Radio
                  key={key}
                  name="dateFormat"
                  checked={dateFormat === key}
                  onChange={() => setDateFormat(key)}
                  label={
                    <>
                      <span className="font-mono">{label}</span>
                      <span className="text-muted"> — {hint}</span>
                    </>
                  }
                />
              ))}
            </fieldset>
          )}

          {error && (
            <div className="border-b border-line px-4 py-3 text-[12px] text-status-hold">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <span className="text-[12px] text-muted">
              {records.length} linha(s) · {schema.length} colunas
            </span>
            <button
              type="button"
              onClick={handleDownload}
              disabled={disabled}
              className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-base transition-opacity disabled:opacity-50"
            >
              {busy ? "Gerando..." : format === "xlsx" ? "Baixar Excel" : "Baixar CSV"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Radio({ name, checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-[13px] text-ink">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 shrink-0 accent-accent"
      />
      <span className="leading-snug">{label}</span>
    </label>
  );
}
