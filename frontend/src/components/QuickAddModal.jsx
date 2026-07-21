import { useState } from "react";
import FieldInput from "./FieldInput";

const QUICK_ADD_FIELDS = ["oc", "tim_key", "site_a", "site_b", "scope"];

export default function QuickAddModal({ schema, onSave, onClose }) {
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fields = QUICK_ADD_FIELDS.map((name) => schema.find((f) => f.internal_name === name)).filter(Boolean);

  function handleChange(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(values);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-md flex-col rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-mono text-[15px] text-ink">Adicionar site</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-muted hover:bg-base hover:text-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form id="quick-add-form" onSubmit={handleSubmit} className="flex flex-col gap-3 px-5 py-4">
          <p className="text-[12px] text-muted">
            Cadastro rápido — os demais campos podem ser preenchidos depois, editando o site.
          </p>
          {fields.map((field) => (
            <FieldInput
              key={field.internal_name}
              field={field}
              value={values[field.internal_name]}
              onChange={handleChange}
            />
          ))}
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
              form="quick-add-form"
              disabled={saving}
              className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-base disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Criar site"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
