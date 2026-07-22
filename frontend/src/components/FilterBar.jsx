import { useMemo } from "react";
import FilterSelect from "./FilterSelect";
import { FILTER_FIELDS, buildOptions, countActiveFilters } from "../filters";

/**
 * Barra de filtros da lista: busca livre + um dropdown por coluna
 * filtrável (ver FILTER_FIELDS em filters.js).
 *
 * links:    lista COMPLETA — as opções de cada dropdown saem daqui, para
 *           que os valores disponíveis não sumam conforme se filtra.
 * filters:  { tim_key: [], hop: [], preliminary_status: [] }
 */
export default function FilterBar({
  links,
  search,
  onSearchChange,
  filters,
  onFilterChange,
  onClearAll,
  resultCount,
}) {
  const optionsByField = useMemo(
    () =>
      Object.fromEntries(
        FILTER_FIELDS.map(({ field }) => [field, buildOptions(links, field)])
      ),
    [links]
  );

  const activeCount = countActiveFilters(filters);
  const hasAnyFilter = activeCount > 0 || search.trim() !== "";

  return (
    <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Buscar por TIM Key, HOP, Site..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-64 rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
      />

      {FILTER_FIELDS.map(({ field, label }) => (
        <FilterSelect
          key={field}
          label={label}
          options={optionsByField[field]}
          selected={filters[field]}
          onChange={(values) => onFilterChange(field, values)}
        />
      ))}

      {hasAnyFilter && (
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-md px-2 py-1.5 text-[12px] text-muted transition-colors hover:text-accent"
        >
          Limpar filtros
        </button>
      )}

      <span className="ml-auto text-[12px] text-muted">
        {resultCount} de {links.length} link(s)
      </span>
    </div>
  );
}
