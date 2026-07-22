import { useState } from "react";
import { api } from "../api";
import { formatTimKey, nextDuVirtual } from "../timKey";

/**
 * Troca de ponta B após um LOS Block (regra do processo):
 *
 *   - A TIM KEY nunca muda - é a referência do cliente.
 *   - A DU Virtual ganha/incrementa o sufixo .LD_x, versionando a troca
 *     ("2025.000610" -> "2025.000610.LD_1" -> ".LD_2"...).
 *   - O SITE B é substituído; os dados derivados dele (END ID B, INFRA
 *     TYPE B, DD B, LAT/LONG B, MUNICÍPIO B, DETENTORA B, SITE STATUS B)
 *     são limpos e re-preenchidos pela planilha de referência quando o
 *     novo site existe lá.
 *   - O HOP é atualizado para o novo par de sites.
 *   - O registro volta para 02.1-Pending Customer Document for LOS (nova
 *     documentação, nova simulação).
 *   - Tudo fica documentado no Preliminary Remark com data:
 *     "[dd/mm/aaaa hh:mm] Troca de ponta B (OURD03 -> SP5503) ..."
 */

const CLEARED_B_FIELDS = {
  end_id_b: null,
  infra_type_b: null,
  dd_b: null,
  lat_b: null,
  long_b: null,
  municipio_b: null,
  detentora_b: null,
  site_status_b: null,
};

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function SwapSiteBModal({ link, onClose, onDone }) {
  const [newSiteB, setNewSiteB] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const timKey = formatTimKey(link.tim_key);
  const newDu = nextDuVirtual(link.du_id_virtual, link.tim_key);
  const siteB = String(newSiteB).trim().toUpperCase();
  const ready = siteB.length > 0 && siteB !== String(link.site_b || "").trim().toUpperCase();

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const entry =
        `[${timestamp()}] Troca de ponta B (${link.site_b || "—"} -> ${siteB}) — LOS Block. ` +
        `DU Virtual: ${link.du_id_virtual || timKey} -> ${newDu}.` +
        (note.trim() ? ` ${note.trim()}` : "");
      const remark = (link.preliminary_remark || "").trim();

      // 1) Troca a ponta e limpa os dados derivados dela
      await api.updateLink(link.id, {
        site_b: siteB,
        hop: [link.site_a, siteB].filter(Boolean).join(","),
        du_id_virtual: newDu,
        los_result: "Block",
        preliminary_remark: remark ? `${remark}\n\n${entry}` : entry,
        ...CLEARED_B_FIELDS,
      });

      // 2) Volta para o aguardo de documentação (nova simulação)
      const afterTransition = await api.transitionLink(link.id, {
        target_code: "02.1",
        retroactive_dates: {},
        manual_dates: {},
        choice_fields: [],
      });

      // 3) Re-preenche os dados da ponta nova pela planilha de referência
      //    (best-effort: se o site não existir lá, os campos ficam vazios
      //    para preenchimento manual)
      const enriched = await api.enrichSiteReference(link.id).catch(() => null);

      onDone?.(enriched || afterTransition);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-mono text-[15px] text-ink">Troca de ponta B — LOS Block</h2>
            <p className="text-[12px] text-muted">
              TIM Key <span className="font-mono text-ink">{timKey}</span> (não muda)
            </p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-muted hover:bg-base hover:text-ink" aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-line bg-base px-4 py-3">
            <div>
              <span className="block text-[11px] text-muted">SITE B atual</span>
              <span className="font-mono text-[13px] text-ink">{link.site_b || "—"}</span>
            </div>
            <div>
              <span className="block text-[11px] text-muted">DU Virtual atual</span>
              <span className="font-mono text-[13px] text-ink">{link.du_id_virtual || "—"}</span>
            </div>
          </div>

          <label className="mb-4 block">
            <span className="mb-1 block text-[12px] text-muted">
              Novo SITE B <span className="text-status-hold">*</span>
            </span>
            <input
              autoFocus
              type="text"
              value={newSiteB}
              onChange={(e) => setNewSiteB(e.target.value)}
              placeholder="ex: SP5503"
              className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 font-mono text-[13px] text-ink outline-none focus:border-accent"
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-1 block text-[12px] text-muted">Observação adicional (opcional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Motivo, detalhes da inviabilidade..."
              className="w-full resize-none rounded-md border border-line bg-base px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
            />
          </label>

          {ready && (
            <div className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-[12px] leading-relaxed text-muted">
              Ao confirmar: SITE B vira <span className="font-mono text-ink">{siteB}</span>, a DU Virtual
              vira <span className="font-mono text-ink">{newDu}</span>, os dados da ponta B são limpos e
              re-preenchidos pela referência, o site volta para{" "}
              <span className="text-ink">02.1-Pending Customer Document for LOS</span> e a troca fica
              registrada no Preliminary Remark.
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
              disabled={!ready || saving}
              onClick={handleConfirm}
              className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-base disabled:opacity-50"
            >
              {saving ? "Aplicando..." : "Confirmar troca"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
