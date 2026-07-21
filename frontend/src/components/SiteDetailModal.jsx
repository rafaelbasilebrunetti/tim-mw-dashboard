import { useEffect, useState } from "react";
import { api } from "../api";
import { groupSchema } from "../schemaUtils";
import { resolveCompletion } from "../statusFlow";
import StatusFlow from "./StatusFlow";

function FieldValue({ field, value }) {
  const label = field.role
    ? `${field.milestone_group} — ${field.role === "planned" ? "Planejado" : "Realizado"}`
    : field.label;

  return (
    <div>
      <span className="block text-[11px] text-muted">{label}</span>
      <span className="font-mono text-[13px] text-ink">{value || "—"}</span>
    </div>
  );
}

export default function SiteDetailModal({ schema, link, onEdit, onClose, onEnriched }) {
  const groups = groupSchema(schema);
  const [displayLink, setDisplayLink] = useState(link);
  const completion = resolveCompletion(displayLink);

  useEffect(() => {
    setDisplayLink(link);
    let cancelled = false;
    // Preenche automaticamente os campos vazios de Site A/B (End ID,
    // Infra Type, Município, Detentora, Lat, Long) com a planilha de
    // referência - nunca sobrescreve o que já estiver preenchido.
    api
      .enrichSiteReference(link.id)
      .then((updated) => {
        if (cancelled) return;
        setDisplayLink(updated);
        onEnriched?.(updated);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [link.id]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-mono text-[15px] text-ink">{displayLink.tim_key || `#${displayLink.id}`}</h2>
            <p className="text-[12px] text-muted">
              {displayLink.site_a || "—"} <span className="text-muted">→</span> {displayLink.site_b || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(displayLink)}
              className="rounded-md border border-line px-3 py-1.5 text-[13px] text-muted hover:text-ink"
            >
              Editar
            </button>
            <button
              onClick={onClose}
              className="rounded-md px-2 py-1 text-muted hover:bg-base hover:text-ink"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-6 rounded-lg border border-line bg-base px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-medium uppercase tracking-wide text-accent">
                Progresso — Preliminary Status
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    completion.completed ? "bg-track-done/15 text-track-done" : "bg-track-planned/15 text-track-planned"
                  }`}
                >
                  {completion.label}
                </span>
                {completion.inconsistent && (
                  <span
                    className="cursor-help text-[13px] text-status-hold"
                    title="Status Detail já passou de 06.0-Pending SSR sem a data de PPI Customer Approval — Realizado preenchida."
                  >
                    ⚠
                  </span>
                )}
              </div>
            </div>
            <StatusFlow mainStatus={displayLink.preliminary_status} detailStatus={displayLink.preliminary_status_detail} />
          </div>

          {Object.entries(groups).map(([groupName, fields]) =>
            fields.length ? (
              <fieldset key={groupName} className="mb-6">
                <legend className="mb-3 text-[13px] font-medium uppercase tracking-wide text-accent">
                  {groupName}
                </legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {fields.map((field) => (
                    <FieldValue key={field.internal_name} field={field} value={displayLink[field.internal_name]} />
                  ))}
                </div>
              </fieldset>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
