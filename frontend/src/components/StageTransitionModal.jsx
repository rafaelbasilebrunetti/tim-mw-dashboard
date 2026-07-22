import { useMemo, useState } from "react";
import { extractCode } from "../statusFlow";

/**
 * Modal de transição de etapa (Preliminary Status Detail). Implementa:
 *
 * Regra 1 - Hold/Cancelled a partir de qualquer etapa: os botões "Mover
 * para Hold" / "Mover para Cancelled" ficam sempre disponíveis e não
 * exigem nenhuma data. Ao sair do Hold/Cancelled, a etapa de retomada
 * sugerida vem de `link.previous_status_detail`, mas pode ser trocada
 * livremente.
 *
 * Regra 2 - Preenchimento retroativo: ao escolher uma etapa que fica à
 * frente de mais de um passo da referência atual, mostra um checklist com
 * cada etapa PULADA (excluindo a etapa de destino) e o(s) campo(s) de data
 * que ela gravaria, permitindo preencher (retroativo, data escolhida pelo
 * usuário) ou deixar em branco.
 *
 * Etapa de destino: se o requisito dela for "auto", a data de hoje é
 * gravada automaticamente pelo backend, sem nenhuma pergunta aqui. Se for
 * "manual" (Regra 7) ou "choice" (Regras 9/13), este modal exige a
 * resposta antes de habilitar o botão de confirmar.
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
  const [dateValues, setDateValues] = useState({}); // field -> "YYYY-MM-DD" (retroativo opcional + manual obrigatório)
  const [choiceSelection, setChoiceSelection] = useState({}); // stageCode -> array de fields da opção escolhida
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const referenceCode = isCurrentlyHold ? previousCode : currentCode;
  const toConfirm = targetCode ? stagesToConfirm(sequential_codes, referenceCode, targetCode) : [];
  const skipped = toConfirm.slice(0, -1); // etapas puladas - excluem a própria etapa de destino
  const targetReq = targetCode ? (stage_date_requirements[targetCode] || [])[0] : null;

  const referenceIndex = referenceCode && sequential_codes.includes(referenceCode)
    ? sequential_codes.indexOf(referenceCode)
    : -1;
  const targetIndex = targetCode && sequential_codes.includes(targetCode)
    ? sequential_codes.indexOf(targetCode)
    : -1;
  const isBackward = referenceIndex !== -1 && targetIndex !== -1 && targetIndex < referenceIndex;

  function detailInfo(code) {
    return status_details.find((d) => d.code === code);
  }

  function setDate(field, value) {
    setDateValues((prev) => ({ ...prev, [field]: value }));
  }

  function selectChoice(stageCode, fields) {
    setChoiceSelection((prev) => ({ ...prev, [stageCode]: fields }));
  }

  // Se a própria etapa de destino exige resposta obrigatória (manual/choice),
  // o botão de confirmar fica desabilitado até ela estar completa.
  const targetChoiceFields = targetCode ? choiceSelection[targetCode] : null;
  const targetManualMissing =
    targetReq?.type === "manual" &&
    targetReq.fields.some((f) => !dateValues[f.field]);
  const targetChoiceMissing = targetReq?.type === "choice" && !targetChoiceFields;
  const targetIncomplete = toConfirm.length > 0 && (targetManualMissing || targetChoiceMissing);

  async function runTransition(code, { skipConfirmPrompt = false } = {}) {
    setError(null);

    if (!skipConfirmPrompt && toConfirm.length === 0 && isBackward) {
      const ok = confirm(
        `Você está voltando de ${referenceCode ? `${referenceCode}-${detailInfo(referenceCode)?.label}` : "—"} para ` +
          `${code}-${detailInfo(code)?.label}. Isso NÃO apaga automaticamente as datas já gravadas nas etapas ` +
          "intermediárias. Deseja continuar?"
      );
      if (!ok) return;
    }

    const retroactive_dates = {};
    skipped.forEach((stageCode) => {
      const reqs = stage_date_requirements[stageCode] || [];
      reqs.forEach((req) => {
        if (req.type === "auto" || req.type === "manual") {
          req.fields.forEach((f) => {
            const value = dateValues[f.field];
            if (value) retroactive_dates[f.field] = value;
          });
        } else {
          const fields = choiceSelection[stageCode];
          const value = dateValues[`${stageCode}:choice`];
          if (fields && value) fields.forEach((field) => (retroactive_dates[field] = value));
        }
      });
    });

    if (
      !skipConfirmPrompt &&
      skipped.length &&
      Object.keys(retroactive_dates).length === 0
    ) {
      const ok = confirm(
        `Esta transição vai pular ${skipped.length} etapa(s) intermediária(s) e nenhuma data retroativa foi ` +
          "preenchida para elas. Elas ficarão sem data registrada. Deseja continuar mesmo assim?"
      );
      if (!ok) return;
    }

    const manual_dates = {};
    let choice_fields = [];
    if (toConfirm.length > 0 && targetReq) {
      if (targetReq.type === "manual") {
        targetReq.fields.forEach((f) => {
          manual_dates[f.field] = dateValues[f.field];
        });
      } else if (targetReq.type === "choice") {
        choice_fields = targetChoiceFields || [];
      }
    }

    setSaving(true);
    try {
      await onTransition({ target_code: code, retroactive_dates, manual_dates, choice_fields });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const showChecklist = targetCode && skipped.length > 0;

  function renderRequirement(stageCode, req, { forTarget }) {
    if (req.type === "auto") {
      return (
        <p className="text-[11px] text-muted">
          {forTarget
            ? "Gravado automaticamente com a data de hoje ao confirmar."
            : "Sem data informada — deixe em branco ou preencha retroativamente:"}
          {!forTarget &&
            req.fields.map((f) => (
              <label key={f.field} className="mt-1 block">
                <span className="mb-1 block text-[11px] text-muted">{f.label}</span>
                <input
                  type="date"
                  value={dateValues[f.field] || ""}
                  onChange={(e) => setDate(f.field, e.target.value)}
                  className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 font-mono text-[13px] text-ink outline-none focus:border-accent"
                />
              </label>
            ))}
        </p>
      );
    }

    if (req.type === "manual") {
      return (
        <>
          {req.fields.map((f) => (
            <label key={f.field} className="mb-2 block last:mb-0">
              <span className="mb-1 block text-[11px] text-muted">
                {f.label}
                {forTarget && <span className="text-status-hold"> *</span>}
              </span>
              <input
                type="date"
                value={dateValues[f.field] || ""}
                onChange={(e) => setDate(f.field, e.target.value)}
                className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 font-mono text-[13px] text-ink outline-none focus:border-accent"
              />
            </label>
          ))}
        </>
      );
    }

    // choice
    const chosen = choiceSelection[stageCode];
    return (
      <div>
        <span className="mb-1 block text-[11px] text-muted">
          {req.label}
          {forTarget && <span className="text-status-hold"> *</span>}
        </span>
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {req.options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => selectChoice(stageCode, opt.fields)}
              className={`rounded-md border px-2.5 py-1 text-[12px] ${
                chosen && chosen.join(",") === opt.fields.join(",")
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-line text-muted hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {chosen && forTarget && (
          <p className="text-[11px] text-muted">Gravado automaticamente com a data de hoje ao confirmar.</p>
        )}
        {chosen && !forTarget && (
          <label className="mt-1 block">
            <span className="mb-1 block text-[11px] text-muted">Data (retroativa)</span>
            <input
              type="date"
              value={dateValues[`${stageCode}:choice`] || ""}
              onChange={(e) => setDate(`${stageCode}:choice`, e.target.value)}
              className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 font-mono text-[13px] text-ink outline-none focus:border-accent"
            />
          </label>
        )}
      </div>
    );
  }

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
                setChoiceSelection({});
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

          {targetCode && toConfirm.length > 0 && targetReq && (
            <div className="mb-4 rounded-lg border border-accent/40 bg-accent/5 px-4 py-4">
              <h3 className="mb-1 text-[13px] font-medium uppercase tracking-wide text-accent">
                Etapa de destino — {detailInfo(targetCode)?.label}
              </h3>
              {renderRequirement(targetCode, targetReq, { forTarget: true })}
            </div>
          )}

          {targetCode && toConfirm.length > 0 && isBackward && (
            <p className="mb-4 text-[11px] text-status-hold">
              Retrocesso: esta transição não apaga automaticamente as datas já gravadas em etapas posteriores.
            </p>
          )}

          {showChecklist && (
            <div className="rounded-lg border border-line bg-base px-4 py-4">
              <h3 className="mb-1 text-[13px] font-medium uppercase tracking-wide text-accent">
                Preenchimento retroativo
              </h3>
              <p className="mb-3 text-[12px] text-muted">
                Esta transição vai pular {skipped.length} etapa(s). Preencha a data de quem já
                aconteceu de fato, ou deixe em branco.
              </p>
              <ol className="space-y-3">
                {skipped.map((stageCode) => {
                  const info = detailInfo(stageCode);
                  const reqs = stage_date_requirements[stageCode];
                  return (
                    <li key={stageCode} className="rounded-md border border-line/70 bg-surface px-3 py-2.5">
                      <div className="mb-2 font-mono text-[12px] text-ink">
                        {stageCode}-{info?.label}
                      </div>
                      {!reqs?.length && <p className="text-[11px] text-muted">Sem coluna de data associada.</p>}
                      {reqs?.map((req, idx) => (
                        <div key={idx} className="mb-2 last:mb-0">
                          {renderRequirement(stageCode, req, { forTarget: false })}
                        </div>
                      ))}
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
              disabled={!targetCode || saving || targetIncomplete}
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
