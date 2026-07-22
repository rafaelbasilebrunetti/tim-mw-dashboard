import { MAIN_STEPS, resolveStatusFlow } from "../statusFlow";

/**
 * Fluxograma reutilizável do "Preliminary Status": trilha horizontal
 * das 7 etapas principais, com a etapa atual destacada e um badge com
 * a sub-etapa (Preliminary Status Detail) correspondente. Só precisa
 * dos dois campos crus do registro - pode ser usado em qualquer lugar
 * do dashboard (drawer de detalhe, tabela, etc.).
 */
export default function StatusFlow({ mainStatus, detailStatus }) {
  const { mainIndex, detailLabel } = resolveStatusFlow(mainStatus, detailStatus);
  const isHold = mainIndex === 0;

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="mx-auto flex w-max">
        {MAIN_STEPS.map((step, i) => {
          const state =
            mainIndex < 0 ? "future" : i < mainIndex ? "done" : i === mainIndex ? "current" : "future";

          const circleClasses = {
            done: "border-track-done bg-track-done text-base",
            current: isHold
              ? "border-status-hold bg-status-hold/20 text-status-hold ring-2 ring-status-hold/40"
              : "border-accent bg-accent/20 text-accent ring-2 ring-accent/40",
            future: "border-line bg-transparent text-muted",
          }[state];

          const labelClasses = state === "future" ? "text-muted" : "text-ink";

          return (
            <div key={step.code} className="flex flex-shrink-0 items-start">
              <div className="flex w-28 flex-col items-center px-1 text-center">
                <div
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-medium ${circleClasses}`}
                >
                  {state === "done" ? "✓" : i}
                </div>
                <span className={`mt-1.5 text-[11px] leading-tight ${labelClasses}`}>{step.label}</span>
                {state === "current" && detailLabel && (
                  <span
                    className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      isHold ? "bg-status-hold/15 text-status-hold" : "bg-accent/15 text-accent"
                    }`}
                  >
                    {detailLabel}
                  </span>
                )}
              </div>
              {i < MAIN_STEPS.length - 1 && (
                <div
                  className={`mt-3.5 h-[2px] w-6 flex-shrink-0 ${
                    i < mainIndex ? "bg-track-done" : "bg-line"
                  }`}
                />
              )}
            </div>
          );
        })}
        </div>
      </div>
      {mainIndex < 0 && (
        <p className="mt-2 text-[11px] text-muted">
          Status não reconhecido: <span className="font-mono">{mainStatus || detailStatus || "—"}</span>
        </p>
      )}
    </div>
  );
}
