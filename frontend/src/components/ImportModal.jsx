import { useState } from "react";
import { api } from "../api";

export default function ImportModal({ onImported, onClose }) {
  const [file, setFile] = useState(null);
  const [upsert, setUpsert] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const result = await api.importFile(file, { upsert });
      setReport(result);
      onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-mono text-[15px] text-ink">Importar dados</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-muted hover:bg-base hover:text-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-4 text-[12px] text-muted">
            Envie uma planilha <span className="font-mono text-ink">.xlsx</span> já tratada, com o mesmo
            padrão de colunas do template de sites.
          </p>

          <label className="mb-3 block">
            <span className="mb-1 block text-[12px] text-muted">Arquivo</span>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setReport(null);
                setError(null);
              }}
              className="block w-full text-[13px] text-ink file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-base"
            />
          </label>

          <label className="mb-4 flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={upsert}
              onChange={(e) => setUpsert(e.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            Atualizar registros existentes com o mesmo TIM Key
          </label>

          {error && (
            <div className="mb-4 rounded-lg border border-status-hold/40 bg-status-hold/10 px-4 py-3 text-[13px] text-status-hold">
              {error}
            </div>
          )}

          {report && (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-track-done/40 bg-track-done/10 px-4 py-3 text-[13px] text-track-done">
                <div>{report.imported} linha(s) importada(s)</div>
                {upsert && <div>{report.updated} linha(s) atualizada(s)</div>}
                <div>{report.skipped_empty} linha(s) vazia(s) ignorada(s)</div>
              </div>

              {(report.unmatched_file_columns?.length > 0 || report.unmatched_schema_fields?.length > 0) && (
                <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-[12px] text-accent">
                  {report.unmatched_file_columns?.length > 0 && (
                    <div className="mb-1">
                      Colunas do arquivo não reconhecidas: {report.unmatched_file_columns.join(", ")}
                    </div>
                  )}
                  {report.unmatched_schema_fields?.length > 0 && (
                    <div>
                      Campos sem coluna correspondente no arquivo (ficaram vazios):{" "}
                      {report.unmatched_schema_fields.join(", ")}
                    </div>
                  )}
                </div>
              )}

              {report.failed?.length > 0 && (
                <div className="rounded-lg border border-status-hold/40 bg-status-hold/10 px-4 py-3 text-[12px] text-status-hold">
                  <div className="mb-1 font-medium">{report.failed.length} linha(s) com erro:</div>
                  <ul className="list-disc pl-4">
                    {report.failed.map((item) => (
                      <li key={item.row}>
                        linha {item.row} (TIM Key: {item.tim_key || "—"}): {item.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-3.5 py-1.5 text-[13px] text-muted hover:text-ink"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!file || loading}
            className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-base disabled:opacity-50"
          >
            {loading ? "Importando..." : "Importar"}
          </button>
        </div>
      </div>
    </div>
  );
}
