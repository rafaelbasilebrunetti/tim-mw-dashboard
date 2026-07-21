import { useMemo, useState } from "react";
import { extractCode } from "../statusFlow";

/**
 * Modal de transição de etapa (Preliminary Status Detail). Implementa
 * duas regras além da transição simples:
 *
 * Regra 1 - Hold/Cancelled a partir de qualquer etapa: os botões "Mover
 * para Hold" / "Mover para Cancelled" ficam sempre disponíveis e não
 * exigem nenhuma data. Ao sair do Hold/Cancelled, a etapa de retomada
 * sugerida vem de `link.previous_status_detail`, mas pode ser trocada
 * livremente.
 *
 * Regra 2 - Preenchimento retroativo: ao escolher uma etapa que fica à
 * frente de mais de um passo da referência atual, mostra um checklist
 * com cada etapa pulada (e a etapa final) e o(s) campo(s) de data que
 * ela grava, permitindo preencher ou deixar em branco cada um.
 */
function stagesToConfirm(sequentialCodes, referenceCode, targetCode) {
  if (!sequentialCodes.includes(targetCode)) return [];
  if (!referenceCode || !sequentialCodes.includes(referenceCode)) return [targetCode];
  const i = sequentialCodes.indexOf(referenceCode);
  const j = sequentialCodes.indexOf(targetCode);
  if (j <= i) return [];
  return sequentialCodes.slice(i + 1, j + 1);
}

export default function StageTransitionModal({ stageFlow, link, onTransition, onClose }) {
  const { status_details, hold_codes, sequential_codes, stage_date_requirements } = stageFlow;

  const currentCode = useMemo(
    () => extractCode(link.preliminary_status_detail) || extractCode(link.preliminary_status),
    [link]
  );
  const isCurrentlyHold = currentCode && hold_codes.includes(currentCode);
  const previousCode = extractCode(link.previous_status_detail);

  const [targetCode, setTargetCode] = useState(
    isCurrentlyHold ? previousCode || "" : ""
  );
  const [dateValues, setDateValues] = useState({});
  const [choiceField, setChoiceField] = useState({}); // key: `${stageCode}:${reqIndex}` -> field escolhido
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const referenceCode = isCurrentlyHold ? previousCode : currentCode;
  const toConfirm = targetCode ? stagesToConfirm(sequential_codes, referenceCode, targetCode) : [];

  function detailInfo(code) {
    return status_details.find((d) => d.code === code);
  }

  function setDate(field, value) {
    setDateValues((prev) => ({ ...prev, [field]: value }));
  }

  function selectChoiceOption(key, field) {
    setChoiceField((prev) => ({ ...prev, [key]: field }));
  }

  async function runTransition(code, { skipConfirmPrompt = false } = {}) {
    setError(null);

    const retroactive_dates = {};
    toConfirm.forEach((stageCode) => {
      const reqs = stage_date_requirements[stageCode] || [];
      reqs.forEach((req, idx) => {
        if (req.type === "single") {
          const value = dateValues[req.field];
          if (value) retroactive_dates[req.field] = value;
        } else {
          const key = `${stageCode}:${idx}`;
          const field = choiceField[key];
          const value = field ? dateValues[field] : null;
          if (field && value) retroactive_dates[field] = value;
        }
      });
    });

    if (!skipConfirmPrompt && toConfirm.length && Object.keys(retroactive_dates).length === 0) {
      const ok = confirm(
        `Nenhuma data retroativa foi preenchida para as ${toConfirm.length} etapa(s) pulada(s). ` +
          "Elas ficarão sem data registrada. Deseja continuar mesmo assim?"
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      await onTransition({ target_code: code, retroactive_dates });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const showChecklist = targetCode && toConfirm.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-mono text-[15px] text-ink">Mudar etapa — {link.tim_key || `#${link.id}`}</h2>
            <p className="text-[12px] text-muted">
              Etapa atual: <span className="text-ink">{link.preliminary_status_detail || "—"}</span>
              {isCurrentlyHold && previousCode && (
                <>
                  {" "}
                  · Etapa antes do Hold/Cancelled:{" "}
                  <span className="text-ink">{link.previous_status_detail}</span>
                </>
              )}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-muted hover:bg-base hover:text-ink" aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!isCurrentlyHold && (
            <div className="mb-5 flex gap-2">
              <button
                disabled={saving}
                onClick={() => runTransition("00.1")}
                className="rounded-md border border-status-hold/50 px-3 py-1.5 text-[13px] font-medium text-status-hold hover:bg-status-hold/10 disabled:opacity-50"
              >
                Mover para Hold
              </button>
              <button
                disabled={saving}
                onClick={() => runTransition("00.0")}
                className="rounded-md border border-status-hold/50 px-3 py-1.5 text-[13px] font-medium text-status-hold hover:bg-status-hold/10 disabled:opacity-50"
              >
                Cancelar site
              </button>
              <span className="self-center text-[11px] text-muted">
                Disponível a partir de qualquer etapa — não exige data.
              </span>
            </div>
          )}

          {isCurrentlyHold && (
            <div className="mb-5 flex items-center gap-2">
              <button
                disabled={saving}
                onClick={() => runTransition(currentCode === "00.1" ? "00.0" : "00.1")}
                className="rounded-md border border-status-hold/50 px-3 py-1.5 text-[13px] font-medium text-status-hold hover:bg-status-hold/10 disabled:opacity-50"
              >
                {currentCode === "00.1" ? "Trocar para Cancelado" : "Trocar para Hold"}
              </button>
              <span className="text-[11px] text-muted">Continua fora do fluxo — não exige data.</span>
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1 block text-[12px] text-muted">
              {isCurrentlyHold ? "Retomar fluxo na etapa" : "Selecionar nova etapa"}
            </label>
            <select
              value={targetCode}
              onChange={(e) => {
                setTargetCode(e.target.value);
                setDateValues({});
                setChoiceField({});
              }}
              className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
            >
              <option value="">Selecione...</option>
              {status_details
                .filter((d) => !hold_codes.includes(d.code))
                .map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code}-{d.label}
                  </option>
                ))}
            </select>
          </div>

          {showChecklist && (
            <div className="rounded-lg border border-line bg-base px-4 py-4">
              <h3 className="mb-1 text-[13px] font-medium uppercase tracking-wide text-accent">
                Preenchimento retroativo
              </h3>
              <p className="mb-3 text-[12px] text-muted">
                Esta transição vai pular {toConfirm.length} etapa(s). Preencha a data de quem já
                aconteceu de fato, ou deixe em branco.
              </p>
              <ol className="space-y-3">
                {toConfirm.map((stageCode) => {
                  const info = detailInfo(stageCode);
                  const reqs = stage_date_requirements[stageCode];
                  return (
                    <li key={stageCode} className="rounded-md border border-line/70 bg-surface px-3 py-2.5">
                      <div className="mb-2 font-mono text-[12px] text-ink">
                        {stageCode}-{info?.label}
                      </div>
                      {!reqs && <p className="text-[11px] text-muted">Sem coluna de data associada.</p>}
                      {reqs?.map((req, idx) => {
                        if (req.type === "single") {
                          return (
                            <label key={req.field} className="mb-2 block last:mb-0">
                              <span className="mb-1 block text-[11px] text-muted">{req.label}</span>
                              <input
                                type="date"
                                value={dateValues[req.field] || ""}
                                onChange={(e) => setDate(req.field, e.target.value)}
                                className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 font-mono text-[13px] text-ink outline-none focus:border-accent"
                              />
                            </label>
                          );
                        }
                        const key = `${stageCode}:${idx}`;
                        const chosenField = choiceField[key];
                        return (
                          <div key={key} className="mb-2 last:mb-0">
                            <span className="mb-1 block text-[11px] text-muted">{req.label}</span>
                            <div className="mb-1.5 flex gap-1.5">
                              {req.options.map((opt) => (
                                <button
                                  key={opt.fields[0]}
                                  type="button"
                                  onClick={() => selectChoiceOption(key, opt.fields[0])}
                                  className={`rounded-md border px-2.5 py-1 text-[12px] ${
                                    chosenField === opt.fields[0]
                                      ? "border-accent bg-accent/15 text-accent"
                                      : "border-line text-muted hover:text-ink"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            {chosenField && (
                              <input
                                type="date"
                                value={dateValues[chosenField] || ""}
                                onChange={(e) => setDate(chosenField, e.target.value)}
                                className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 font-mono text-[13px] text-ink outline-none focus:border-accent"
                              />
                            )}
                          </div>
                        );
                      })}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          <span className="text-[12px] text-status-hold">{error}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line px-3.5 py-1.5 text-[13px] text-muted hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!targetCode || saving}
              onClick={() => runTransition(targetCode)}
              className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-base disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Confirmar transição"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
