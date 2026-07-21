export default function MilestoneTrack({ track }) {
  if (!track.length) return null;

  return (
    <div className="flex items-center gap-[3px]" title="Progresso do pipeline">
      {track.map((step, i) => (
        <div key={step.name} className="group relative flex items-center">
          <span
            className={[
              "block h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125",
              step.status === "done" && "bg-track-done",
              step.status === "planned" &&
                "bg-transparent border-2 border-track-planned",
              step.status === "pending" && "bg-track-pending/40",
            ]
              .filter(Boolean)
              .join(" ")}
          />
          {i < track.length - 1 && (
            <span
              className={[
                "h-[2px] w-3",
                step.status === "done" ? "bg-track-done" : "bg-track-pending/30",
              ].join(" ")}
            />
          )}

          {/* Tooltip */}
          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-ink opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            <div className="font-medium">{step.name}</div>
            <div className="text-muted">
              {step.status === "done" && `Realizado ${step.realizedValue ?? ""}`}
              {step.status === "planned" && `Planejado ${step.plannedValue ?? ""}`}
              {step.status === "pending" && "Não iniciado"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
