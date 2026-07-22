import { useMemo, useRef, useState } from "react";
import { useDismiss } from "../useDismiss";

/**
 * Dropdown de seleção múltipla com busca interna.
 *
 * Serve para listas curtas (Status, ~7 valores) e longas (TIM Key, ~250)
 * com o mesmo componente: o campo de busca no topo do painel resolve o
 * caso longo sem precisar de outro controle.
 *
 * options: [{ value, label, count }]
 * selected: array de "value" marcados ([] = filtro inativo, mostra tudo)
 */
export default function FilterSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);

  useDismiss(containerRef, open, () => setOpen(false));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);

  const active = selected.length > 0;

  function toggle(value) {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
          active
            ? "border-accent/60 bg-accent/10 text-ink"
            : "border-line bg-surface text-muted hover:text-ink"
        }`}
      >
        {label}
        {active && (
          <span className="rounded-full bg-accent px-1.5 font-mono text-[11px] font-medium text-base">
            {selected.length}
          </span>
        )}
        <span className="text-[9px] text-muted">▼</span>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1.5 w-72 rounded-lg border border-line bg-surface shadow-2xl">
          <div className="border-b border-line p-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar em ${label}...`}
              className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {visible.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-muted">
                Nenhum valor encontrado.
              </div>
            ) : (
              visible.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-ink hover:bg-base"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => toggle(option.value)}
                    className="h-3.5 w-3.5 shrink-0 accent-accent"
                  />
                  <span className="truncate" title={option.label}>
                    {option.label}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-muted">
                    {option.count}
                  </span>
                </label>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[12px]">
            <span className="text-muted">
              {active ? `${selected.length} selecionado(s)` : "Nenhum filtro"}
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={!active}
              className="text-muted transition-colors hover:text-accent disabled:cursor-default disabled:opacity-40 disabled:hover:text-muted"
            >
              Limpar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
