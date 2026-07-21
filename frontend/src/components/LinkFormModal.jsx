import { useState } from "react";
import { groupSchema } from "../schemaUtils";

function FieldInput({ field, value, onChange }) {
  const inputType = field.type === "date" ? "date" : field.type === "integer" || field.type === "float" ? "number" : "text";
  const label = field.role
    ? `${field.milestone_group} — ${field.role === "planned" ? "Planejado" : "Realizado"}`
    : field.label;

  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted">{label}</span>
      <input
        type={inputType}
        step={field.type === "float" ? "any" : undefined}
        value={value ?? ""}
        onChange={(e) => onChange(field.internal_name, e.target.value)}
        className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 font-mono text-[13px] text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      />
    </label>
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
