import { SELECT_OPTIONS } from "../schemaUtils";

export default function FieldInput({ field, value, onChange }) {
  const inputType = field.type === "date" ? "date" : field.type === "integer" || field.type === "float" ? "number" : "text";
  const label = field.role
    ? `${field.milestone_group} — ${field.role === "planned" ? "Planejado" : "Realizado"}`
    : field.label;
  const options = SELECT_OPTIONS[field.internal_name];

  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted">{label}</span>
      {options ? (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(field.internal_name, e.target.value)}
          className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 font-mono text-[13px] text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="">— selecione —</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={inputType}
          step={field.type === "float" ? "any" : undefined}
          value={value ?? ""}
          onChange={(e) => onChange(field.internal_name, e.target.value)}
          className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 font-mono text-[13px] text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      )}
    </label>
  );
}
