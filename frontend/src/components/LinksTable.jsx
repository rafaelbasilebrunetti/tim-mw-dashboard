import MilestoneTrack from "./MilestoneTrack";
import { buildMilestoneTrack, statusColor } from "../schemaUtils";

const BADGE = {
  green: "bg-track-done/15 text-track-done",
  amber: "bg-track-planned/15 text-track-planned",
  red: "bg-status-hold/15 text-status-hold",
  gray: "bg-muted/15 text-muted",
};

export default function LinksTable({ schema, links, onEdit, onDelete }) {
  if (!links.length) {
    return (
      <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center text-muted">
        Nenhum link cadastrado ainda. Clique em <span className="text-ink">"Novo link"</span> para começar.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line bg-surface text-[11px] uppercase tracking-wide text-muted">
            <th className="px-3 py-2.5 font-medium">TIM Key</th>
            <th className="px-3 py-2.5 font-medium">HOP</th>
            <th className="px-3 py-2.5 font-medium">Site A → Site B</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Owner</th>
            <th className="px-3 py-2.5 font-medium">Pipeline</th>
            <th className="px-3 py-2.5 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => {
            const color = statusColor(link.preliminary_status);
            const track = buildMilestoneTrack(schema, link);
            return (
              <tr
                key={link.id}
                className="border-b border-line/60 last:border-0 hover:bg-surface/60"
              >
                <td className="px-3 py-2.5 font-mono text-ink">{link.tim_key || "—"}</td>
                <td className="px-3 py-2.5 font-mono text-muted">{link.hop || "—"}</td>
                <td className="px-3 py-2.5 text-ink">
                  {link.site_a || "—"} <span className="text-muted">→</span> {link.site_b || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[color]}`}>
                    {link.preliminary_status || "Sem status"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted">{link.owner || "—"}</td>
                <td className="px-3 py-2.5">
                  <MilestoneTrack track={track} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    onClick={() => onEdit(link)}
                    className="mr-3 text-muted hover:text-accent"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onDelete(link.id)}
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
