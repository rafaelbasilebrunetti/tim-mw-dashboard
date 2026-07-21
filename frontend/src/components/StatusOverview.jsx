import { resolveCompletion } from "../statusFlow";

const DOT = {
  green: "bg-track-done",
  amber: "bg-track-planned",
  red: "bg-status-hold",
  gray: "bg-track-pending",
};

export default function StatusOverview({ links }) {
  const total = links.length;
  const completed = links.filter((l) => resolveCompletion(l).completed).length;
  const holds = links.filter((l) => l.hold && String(l.hold).trim() !== "").length;

  const cards = [
    { label: "Total de Links", value: total, dot: null },
    { label: "Em andamento", value: total - completed, dot: DOT.amber },
    { label: "Concluídos", value: completed, dot: DOT.green },
    { label: "Em Hold", value: holds, dot: DOT.red },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-line bg-surface px-4 py-3"
        >
          <div className="flex items-center gap-2 text-[13px] text-muted">
            {c.dot && <span className={`h-2 w-2 rounded-full ${c.dot}`} />}
            {c.label}
          </div>
          <div className="mt-1 font-mono text-2xl text-ink">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
