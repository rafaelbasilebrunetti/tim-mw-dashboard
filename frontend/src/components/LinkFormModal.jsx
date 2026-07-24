import { useState } from "react";
import { groupSchema, buildMilestoneGroups, isSuspiciousDateValue } from "../schemaUtils";
import FieldInput from "./FieldInput";

const CRONOGRAMA_GROUP = "Cronograma (Planejado / Realizado)";

/** Uma célula de data do cronograma: input normal, ou texto realçado quando o valor é suspeito (ver isSuspiciousDateValue). */
function ScheduleDateInput({ field, value, onChange }) {
  if (!field) return <span className="block px-2 py-1.5 text-[12.5px] text-muted">—</span>;
  const suspicious = isSuspiciousDateValue(value);
  return (
    <input
      type={suspicious ? "text" : "date"}
      value={value ?? ""}
      onChange={(e) => onChange(field, e.target.value)}
      title={
        suspicious
          ? "Data suspeita (possível erro de planilha, ex: \"#REF!\" ou época 1900) — revise ou limpe."
          : undefined
      }
      className={`w-full rounded-md border bg-base px-2 py-1.5 font-mono text-[12.5px] text-ink outline-none focus:ring-1 ${
        suspicious
          ? "border-status-hold/60 text-status-hold focus:border-status-hold focus:ring-status-hold"
          : "border-line focus:border-accent focus:ring-accent"
      }`}
    />
  );
}

/**
 * Tabela editável do cronograma: uma linha por etapa (milestone_group),
 * Planejado e Realizado lado a lado - mesmo layout de leitura de
 * MilestoneDatesTable (SiteDetailModal.jsx), mas com inputs de data.
 */
function ScheduleTable({ schema, values, onChange }) {
  const groups = buildMilestoneGroups(schema);
  if (!groups.length) return <p className="text-[13px] text-muted">Sem colunas de cronograma no schema.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="bg-base text-[11px] uppercase tracking-wide text-muted">
            <th className="px-3 py-2 font-medium">Etapa</th>
            <th className="px-3 py-2 font-medium">Planejado</th>
            <th className="px-3 py-2 font-medium">Realizado</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.name} className="border-t border-line/60">
              <td className="px-3 py-2 text-ink">{group.name}</td>
              <td className="px-2 py-1.5">
                <ScheduleDateInput
                  field={group.planned}
                  value={group.planned ? values[group.planned] : null}
                  onChange={onChange}
                />
              </td>
              <td className="px-2 py-1.5">
                <ScheduleDateInput
                  field={group.realized}
                  value={group.realized ? values[group.realized] : null}
                  onChange={onChange}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LinkFormModal({ schema, initialData, onSave, onClose }) {
  const [values, setValues] = useState(initialData || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const groups = groupSchema(schema);
  const isEditing = Boolean(initialData?.id);

  function handleChange(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { id, updated_at, ...payload } = values;
      await onSave(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-mono text-[15px] text-ink">
            {isEditing ? `Editar link — ${values.tim_key || values.oc || "#" + values.id}` : "Novo link"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-muted hover:bg-base hover:text-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form id="link-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4">
          {Object.entries(groups).map(([groupName, fields]) =>
            fields.length ? (
              <fieldset key={groupName} className="mb-6">
                <legend className="mb-3 text-[13px] font-medium uppercase tracking-wide text-accent">
                  {groupName}
                </legend>
                {groupName === CRONOGRAMA_GROUP ? (
                  <ScheduleTable schema={schema} values={values} onChange={handleChange} />
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {fields.map((field) => (
                      <FieldInput
                        key={field.internal_name}
                        field={field}
                        value={values[field.internal_name]}
                        onChange={handleChange}
                      />
                    ))}
                  </div>
                )}
              </fieldset>
            ) : null
          )}
        </form>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          <span className="text-[12px] text-status-hold">{error}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line px-3.5 py-1.5 text-[13px] text-muted hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="link-form"
              disabled={saving}
              className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-base disabled:opacity-50"
            >
              {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
