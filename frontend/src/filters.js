/**
 * filters.js
 * ----------
 * Fonte única da lógica de filtragem da lista de links. Fica separada dos
 * componentes para que a barra de filtros (que monta as opções) e o App
 * (que aplica o recorte) nunca discordem sobre o que é "estar filtrado".
 *
 * Para adicionar um filtro novo (ex: Owner, Situação), basta acrescentar
 * uma entrada em FILTER_FIELDS — a barra e a filtragem se ajustam sozinhas.
 */

export const FILTER_FIELDS = [
  { field: "tim_key", label: "TIM Key" },
  { field: "hop", label: "HOP" },
  { field: "preliminary_status", label: "Status" },
];

/** Rótulo mostrado no lugar de um valor em branco. */
export const EMPTY_LABEL = "— sem valor —";

/** Campos varridos pela busca livre. */
const SEARCH_FIELDS = ["tim_key", "hop", "site_a", "site_b", "oc"];

export function emptyFilters() {
  return Object.fromEntries(FILTER_FIELDS.map(({ field }) => [field, []]));
}

function normalize(value) {
  return String(value ?? "").trim();
}

/**
 * Lista de opções de um filtro, com a contagem de links por valor, na
 * ordem em que aparecem no dropdown. Construída sempre a partir da lista
 * COMPLETA de links: assim os valores disponíveis não somem conforme
 * outros filtros são aplicados.
 */
export function buildOptions(links, field) {
  const counts = new Map();

  for (const link of links) {
    const value = normalize(link[field]);
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => {
      if (a === b) return 0;
      // Valores em branco ficam por último, sempre.
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b, "pt-BR", { numeric: true });
    })
    .map(([value, count]) => ({ value, label: value || EMPTY_LABEL, count }));
}

/** Aplica busca livre + filtros por coluna. */
export function applyFilters(links, { search = "", filters = {} } = {}) {
  const query = search.trim().toLowerCase();

  return links.filter((link) => {
    if (query && !SEARCH_FIELDS.some((f) => normalize(link[f]).toLowerCase().includes(query))) {
      return false;
    }

    return FILTER_FIELDS.every(({ field }) => {
      const selected = filters[field];
      if (!selected || selected.length === 0) return true;
      return selected.includes(normalize(link[field]));
    });
  });
}

export function countActiveFilters(filters = {}) {
  return Object.values(filters).reduce((total, values) => total + (values?.length || 0), 0);
}
