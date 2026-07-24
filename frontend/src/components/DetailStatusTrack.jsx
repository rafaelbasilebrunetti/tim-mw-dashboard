import { useState } from "react";
import { api } from "../api";
import {
  HOLD_DETAIL_CODES,
  LOS_RESULT_OPTIONS,
  buildDetailTrack,
  detailLabelOf,
  extractCode,
  formatDateBR,
} from "../statusFlow";

/**
 * Trilha do Preliminary Status Detail, seguindo o fluxograma do processo.
 *
 * - Interrupções (00.0/00.1/03.0/04.0/06.1) NÃO são nós: cada uma é um
 *   chip para marcar/desmarcar. Marcada, a trilha mostra tudo até o ponto
 *   da parada e um marcador vermelho ali (ex: PPI Hold para antes do 04.1).
 *   Desmarcar retoma a etapa registrada em previous_status_detail.
 * - Bifurcação do LOS: o seletor Prospection/Simulation/Block registra o
 *   resultado (campo LOS Result). Simulation esconde as etapas de campo
 *   (03.1/03.2) - caminho do TSSR Execution. Block sinaliza o retorno
 *   para SAR/PE.
 * - Datas embaixo de cada nó, apenas quando a etapa foi passada.
 */

const HOLD_CHIP_LABELS = {
  "00.1": "Hold",
  "00.0": "Cancelled",
  "03.0": "Survey Hold",
  "04.0": "PPI Hold",
  "06.1": "SSR Hold",
};

export default function DetailStatusTrack({ link, onChanged, onSwapSiteB }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const {
    nodes,
    holdStop,
    losResult,
    fieldSkipped,
    swapSkipped,
    scopeInconsistent,
    scopeInconsistentCode,
  } = buildDetailTrack(link);
  const currentCode =
    extractCode(link.preliminary_status_detail) || extractCode(link.preliminary_status);
  const previousCode = extractCode(link.previous_status_detail);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      onChanged?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleHold(code) {
    if (busy) return;
    if (currentCode === code) {
      // Desmarcar = retomar de onde parou.
      if (!previousCode) {
        setError("Sem etapa anterior registrada para retomar — use o botão Mudar etapa.");
        return;
      }
      if (!confirm(`Desmarcar ${detailLabelOf(code)} e retomar em ${detailLabelOf(previousCode)}?`)) return;
      run(() =>
        api.transitionLink(link.id, {
          target_code: previousCode,
          retroactive_dates: {},
          manual_dates: {},
          choice_fields: [],
        })
      );
    } else {
      if (!confirm(`Mover ${link.tim_key || "#" + link.id} para ${detailLabelOf(code)}?`)) return;
      run(() =>
        api.transitionLink(link.id, {
          target_code: code,
          retroactive_dates: {},
          manual_dates: {},
          choice_fields: [],
        })
      );
    }
  }

  function setLosResult(value) {
    if (busy) return;
    const next = losResult === value ? "" : value;
    run(() => api.updateLink(link.id, { los_result: next }));
  }

  return (
    <div>
      {/* ---------- bifurcação + interrupções ---------- */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted">Resultado do LOS:</span>
          {LOS_RESULT_OPTIONS.map((opt) => {
            const active = losResult === opt;
            const danger = opt === "Block";
            return (
              <button
                key={opt}
                type="button"
                disabled={busy}
                onClick={() => setLosResult(opt)}
                className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-50 ${
                  active
                    ? danger
                      ? "border-status-hold bg-status-hold/15 text-status-hold"
                      : "border-accent bg-accent/15 text-accent"
                    : "border-line text-muted hover:text-ink"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted">Interrupções:</span>
          {HOLD_DETAIL_CODES.map((code) => {
            const active = currentCode === code;
            return (
              <button
                key={code}
                type="button"
                disabled={busy}
                onClick={() => toggleHold(code)}
                title={active ? "Clique para desmarcar e retomar o fluxo" : `Marcar ${detailLabelOf(code)}`}
                className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-50 ${
                  active
                    ? "border-status-hold bg-status-hold/15 font-medium text-status-hold"
                    : "border-line text-muted hover:text-status-hold"
                }`}
              >
                {HOLD_CHIP_LABELS[code]}
              </button>
            );
          })}
        </div>
      </div>

      {swapSkipped && (
        <p className="mb-3 text-center text-[11px] text-muted">
          Caminho SWAP: direto para TSSR Execution — etapas de LOS/documentação/campo (02.1 a 03.3) puladas.
        </p>
      )}
      {!swapSkipped && fieldSkipped && (
        <p className="mb-3 text-center text-[11px] text-muted">
          Caminho Simulation: etapas de campo (03.1/03.2) puladas — TSSR Execution sem visita.
        </p>
      )}
      {scopeInconsistent && (
        <p className="mb-3 text-center text-[11px] text-status-hold">
          Inconsistência: {link.tim_key || `#${link.id}`} é SWAP, mas está em {detailLabelOf(scopeInconsistentCode)},
          uma etapa que não existe no caminho SWAP.
        </p>
      )}
      {losResult === "Block" && (
        <p className="mb-3 flex items-center justify-center gap-3 text-center text-[11px] text-status-hold">
          LOS Block: retorno para SAR/PE — a simulação precisa ser refeita com nova documentação.
          {onSwapSiteB && (
            <button
              type="button"
              disabled={busy}
              onClick={onSwapSiteB}
              className="rounded-md border border-status-hold/50 px-2.5 py-1 text-[12px] font-medium text-status-hold transition-colors hover:bg-status-hold/10 disabled:opacity-50"
            >
              Registrar troca de ponta B →
            </button>
          )}
        </p>
      )}

      {/* ---------- trilha ---------- */}
      <div className="overflow-x-auto pb-1">
        <div className="mx-auto flex w-max items-start">
          {nodes.map((node, i) => {
            const showStopHere = holdStop && holdStop.atIndex === i;
            const circle = {
              done: "border-track-done bg-track-done text-base",
              current: "border-accent bg-accent/20 text-accent ring-2 ring-accent/40",
              future: "border-line bg-transparent text-muted",
            }[node.state];

            return (
              <div key={node.code} className="flex items-start">
                {showStopHere && (
                  <div className="flex w-24 flex-col items-center px-1 text-center">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-status-hold bg-status-hold/20 text-[13px] text-status-hold ring-2 ring-status-hold/40">
                      ⏸
                    </div>
                    <span className="mt-1.5 text-[11px] font-medium leading-tight text-status-hold">
                      {holdStop.label}
                    </span>
                  </div>
                )}
                {showStopHere && (
                  <div className="mt-3.5 h-[2px] w-5 flex-shrink-0 bg-line" />
                )}

                <div className="flex w-24 flex-col items-center px-1 text-center">
                  <div
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-medium ${circle}`}
                  >
                    {node.state === "done" ? "✓" : node.code}
                  </div>
                  <span
                    className={`mt-1.5 text-[10.5px] leading-tight ${
                      node.state === "future" ? "text-muted" : "text-ink"
                    }`}
                  >
                    {node.label.replace(`${node.code}-`, "")}
                  </span>
                  {node.dates.map((d) => (
                    <span
                      key={d.label}
                      title={d.label}
                      className="mt-1 font-mono text-[10px] leading-tight text-track-done"
                    >
                      {formatDateBR(d.value)}
                    </span>
                  ))}
                </div>

                {i < nodes.length - 1 && (
                  <div
                    className={`mt-3.5 h-[2px] w-5 flex-shrink-0 ${
                      node.state === "done" && !(holdStop && holdStop.atIndex === i + 1)
                        ? "bg-track-done"
                        : "bg-line"
                    }`}
                  />
                )}
              </div>
            );
          })}

          {/* Interrupção depois do último nó visível (ex: 00.x sem previous) */}
          {holdStop && holdStop.atIndex >= nodes.length && (
            <>
              <div className="mt-3.5 h-[2px] w-5 flex-shrink-0 bg-line" />
              <div className="flex w-24 flex-col items-center px-1 text-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-status-hold bg-status-hold/20 text-[13px] text-status-hold ring-2 ring-status-hold/40">
                  ⏸
                </div>
                <span className="mt-1.5 text-[11px] font-medium leading-tight text-status-hold">
                  {holdStop.label}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-center text-[12px] text-status-hold">{error}</p>}
    </div>
  );
}
