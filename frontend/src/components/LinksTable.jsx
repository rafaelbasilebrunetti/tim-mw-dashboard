import MilestoneTrack from "./MilestoneTrack";
import { buildMilestoneTrack, statusColor } from "../schemaUtils";
import { resolveCompletion } from "../statusFlow";

const BADGE = {
  green: "bg-track-done/15 text-track-done",
  amber: "bg-track-planned/15 text-track-planned",
  red: "bg-status-hold/15 text-status-hold",
  gray: "bg-muted/15 text-muted",
};

// Larguras fixas por coluna (com table-fixed abaixo). Somam ~1350px, que
// cabe inteiro no container de 1800px — é o que elimina o scroll lateral
// e a quebra de linha em "02-LOS Simulation / Link Design".
const COLUMNS = [
  { key: "tim_key", label: "TIM Key", width: "w-[120px]" },
  { key: "hop", label: "HOP", width: "w-[190px]" },
  { key: "sites", label: "Site A → Site B", width: "w-[230px]" },
  { key: "status", label: "Status", width: "w-[250px]" },
  { key: "situacao", label: "Situação", width: "w-[130px]" },
  { key: "owner", label: "Owner", width: "w-[130px]" },
  { key: "pipeline", label: "Pipeline", width: "w-[190px]" },
  { key: "acoes", label: "Ações", width: "w-[120px]", align: "text-right" },
];

export default function LinksTable({
  schema,
  links,
  filtersActive,
  onClearFilters,
  onSelect,
  onEdit,
  onDelete,
}) {
  if (!links.length) {
    // Lista vazia por causa do filtro é uma situação diferente de base
    // vazia — e tem uma saída óbvia, que é limpar o filtro.
    return (
      <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center text-muted">
        {filtersActive ? (
          <>
            <p>Nenhum link corresponde aos filtros aplicados.</p>
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-3 rounded-md border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:text-accent"
            >
              Limpar filtros
            </button>
          </>
        ) : (
          <>
            Nenhum link cadastrado ainda. Clique em{" "}
            <span className="text-ink">"+ Adicionar Site"</span> para começar.
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-h-[calc(100vh-19rem)] overflow-auto rounded-lg border border-line">
      <table className="w-full min-w-[1280px] table-fixed border-collapse text-left text-[13px]">
        <colgroup>
          {COLUMNS.map((col) => (
            <col key={col.key} className={col.width} />
          ))}
        </colgroup>
        <thead>
          {/* sticky: o cabeçalho fica visível enquanto se rola os 253 links */}
          <tr className="text-[11px] uppercase tracking-wide text-muted">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`sticky top-0 z-10 bg-surface px-3 py-2.5 font-medium shadow-[0_1px_0_0_#262E33] ${
                  col.align || ""
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {links.map((link) => {
            const color = statusColor(link.preliminary_status);
            const track = buildMilestoneTrack(schema, link);
            const completion = resolveCompletion(link);
            const sites = `${link.site_a || "—"} → ${link.site_b || "—"}`;
            return (
              <tr
                key={link.id}
                onClick={() => onSelect(link)}
                className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-surface/60"
              >
                <td className="truncate px-3 py-2.5 font-mono text-ink" title={link.tim_key || ""}>
                  {link.tim_key || "—"}
                </td>
                <td className="truncate px-3 py-2.5 font-mono text-muted" title={link.hop || ""}>
                  {link.hop || "—"}
                </td>
                <td className="truncate px-3 py-2.5 text-ink" title={sites}>
                  {link.site_a || "—"} <span className="text-muted">→</span> {link.site_b || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-block max-w-full truncate whitespace-nowrap rounded-full px-2 py-0.5 align-middle text-[11px] font-medium ${BADGE[color]}`}
                    title={link.preliminary_status || ""}
                  >
                    {link.preliminary_status || "Sem status"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        completion.completed
                          ? "bg-track-done/15 text-track-done"
                          : "bg-track-planned/15 text-track-planned"
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
                  </span>
                </td>
                <td className="truncate px-3 py-2.5 text-muted" title={link.owner || ""}>
                  {link.owner || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <MilestoneTrack track={track} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(link);
                    }}
                    className="mr-3 text-muted hover:text-accent"
                  >
                    Editar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(link.id);
                    }}
                    className="text-muted hover:text-status-hold"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
