import { useEffect, useState } from "react";
import { api } from "../api";
import { resolveCompletion, mainLabelForDetailCode, resolveOwner, extractCode } from "../statusFlow";
import StatusFlow from "./StatusFlow";
import DetailStatusTrack from "./DetailStatusTrack";
import RemarkModal from "./RemarkModal";
import SwapSiteBModal from "./SwapSiteBModal";
import PipelineModal from "./PipelineModal";
import { formatDateBR } from "../statusFlow";

/** Uma célula rótulo/valor simples, usada nos layouts fixos abaixo. */
function Field({ label, value, mono = true }) {
  return (
    <div>
      <span className="block text-[11px] text-muted">{label}</span>
      <span className={`text-[13px] text-ink ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-accent">{children}</h3>;
}

/**
 * Tabela com TODAS as datas do cronograma (pares Planejado/Realizado do
 * schema, na ordem da planilha). É o "todas as datas voltam a aparecer
 * no final do detalhamento" - a trilha lá em cima mostra só as datas das
 * etapas passadas; aqui fica o quadro completo, inclusive planejados.
 */
function MilestoneDatesTable({ schema, link }) {
  // Agrupa preservando a ordem de aparição na planilha.
  const groups = [];
  const byName = new Map();
  for (const field of [...schema].sort((a, b) => a.index - b.index)) {
    if (!field.milestone_group) continue;
    if (!byName.has(field.milestone_group)) {
      const group = { name: field.milestone_group, planned: null, realized: null };
      byName.set(field.milestone_group, group);
      groups.push(group);
    }
    byName.get(field.milestone_group)[field.role] = field.internal_name;
  }

  if (!groups.length) return <p className="text-[13px] text-muted">Sem colunas de cronograma no schema.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="bg-base text-[11px] uppercase tracking-wide text-muted">
            <th className="px-3 py-2 font-medium">Etapa</th>
            <th className="px-3 py-2 font-medium">Planejado</th>
            <th className="px-3 py-2 font-medium">Realizado</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const planned = group.planned ? link[group.planned] : null;
            const realized = group.realized ? link[group.realized] : null;
            return (
              <tr key={group.name} className="border-t border-line/60">
                <td className="px-3 py-2 text-ink">{group.name}</td>
                <td className="px-3 py-2 font-mono text-muted">{planned ? formatDateBR(planned) : "—"}</td>
                <td className={`px-3 py-2 font-mono ${realized ? "text-track-done" : "text-muted"}`}>
                  {realized ? formatDateBR(realized) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SiteDetailModal({ schema = [], link, onEdit, onTransition, onClose, onEnriched }) {
  const [displayLink, setDisplayLink] = useState(link);
  const [showRemarks, setShowRemarks] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);
  const [showSwapB, setShowSwapB] = useState(false);
  const completion = resolveCompletion(displayLink);

  // Mantém displayLink em dia sempre que o registro mudar por fora (ex:
  // depois de uma transição de etapa ou de um comentário novo) - não só
  // na primeira renderização de um site diferente.
  useEffect(() => {
    setDisplayLink(link);
  }, [link]);

  useEffect(() => {
    let cancelled = false;
    // Preenche automaticamente os campos vazios de Site A/B (End ID,
    // Infra Type, Município, Detentora, Lat, Long) com a planilha de
    // referência - nunca sobrescreve o que já estiver preenchido. Só
    // roda uma vez por site (id), não a cada atualização do registro.
    api
      .enrichSiteReference(link.id)
      .then((updated) => {
        if (cancelled) return;
        setDisplayLink(updated);
        onEnriched?.(updated);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [link.id]);

  function handleRemarkSaved(updated) {
    setDisplayLink(updated);
    onEnriched?.(updated);
  }

  // Preliminary Status NUNCA é um campo à parte na tela: ele sempre segue
  // o que Preliminary Status Detail diz (ver statusFlow.mainLabelForDetailCode).
  // Se o texto salvo não bater com nenhum código conhecido, cai para o que
  // já estava gravado, para nunca mostrar a tela em branco por causa de um
  // dado antigo/fora do padrão.
  const detailCode = extractCode(displayLink.preliminary_status_detail) || extractCode(displayLink.preliminary_status);
  const mainStatusLabel = mainLabelForDetailCode(detailCode) || displayLink.preliminary_status || "—";
  const detailLabel = displayLink.preliminary_status_detail || "—";
  const owner = resolveOwner(detailCode);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex h-[92vh] w-full max-w-[1500px] flex-col rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-mono text-[15px] text-ink">{displayLink.tim_key || `#${displayLink.id}`}</h2>
            <p className="text-[12px] text-muted">
              {displayLink.site_a || "—"} <span className="text-muted">→</span> {displayLink.site_b || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPipeline(true)}
              className="rounded-md border border-line px-3 py-1.5 text-[13px] text-muted hover:text-ink"
            >
              Ver fluxograma
            </button>
            <button
              onClick={() => onTransition(displayLink)}
              className="rounded-md border border-line px-3 py-1.5 text-[13px] text-muted hover:text-ink"
            >
              Mudar etapa
            </button>
            <button
              onClick={() => onEdit(displayLink)}
              className="rounded-md border border-line px-3 py-1.5 text-[13px] text-muted hover:text-ink"
            >
              Editar
            </button>
            <button
              onClick={onClose}
              className="rounded-md px-2 py-1 text-muted hover:bg-base hover:text-ink"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ---------- Progresso ---------- */}
          <div className="mb-6 rounded-lg border border-line bg-base px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-medium uppercase tracking-wide text-accent">
                Progresso — Preliminary Status
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    completion.completed ? "bg-track-done/15 text-track-done" : "bg-track-planned/15 text-track-planned"
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
              </div>
            </div>
            <StatusFlow mainStatus={displayLink.preliminary_status} detailStatus={displayLink.preliminary_status_detail} />

            <div className="mt-4 border-t border-line/60 pt-4">
              <h3 className="mb-3 text-center text-[13px] font-medium uppercase tracking-wide text-accent">
                Preliminary Status Detail
              </h3>
              <DetailStatusTrack link={displayLink} onChanged={handleRemarkSaved} onSwapSiteB={() => setShowSwapB(true)} />
            </div>
          </div>

          {/* ---------- Identificação (ordem fixa) ---------- */}
          <fieldset className="mb-6">
            <SectionTitle>Identificação</SectionTitle>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-5 gap-3">
                <Field label="OC" value={displayLink.oc} />
                <Field label="TIM KEY" value={displayLink.tim_key} />
                <Field label="HOP" value={displayLink.hop} />
                <Field label="DU VIRTUAL" value={displayLink.du_id_virtual} />
                <Field label="DU PRELIMINAR" value={displayLink.du_id_preliminar} />
              </div>
              <div className="grid grid-cols-7 gap-3 border-t border-line/60 pt-3">
                <Field label="SITE A" value={displayLink.site_a} />
                <Field label="END ID A" value={displayLink.end_id_a} />
                <Field label="INFRA TYPE A" value={displayLink.infra_type_a} mono={false} />
                <Field label="DD A" value={displayLink.dd_a} />
                <Field label="MUNICÍPIO A" value={displayLink.municipio_a} mono={false} />
                <Field label="DETENTORA A" value={displayLink.detentora_a} mono={false} />
                <Field label="SITE STATUS A" value={displayLink.site_status_a} mono={false} />
              </div>
              <div className="grid grid-cols-7 gap-3 border-t border-line/60 pt-3">
                <Field label="SITE B" value={displayLink.site_b} />
                <Field label="END ID B" value={displayLink.end_id_b} />
                <Field label="INFRA TYPE B" value={displayLink.infra_type_b} mono={false} />
                <Field label="DD B" value={displayLink.dd_b} />
                <Field label="MUNICÍPIO B" value={displayLink.municipio_b} mono={false} />
                <Field label="DETENTORA B" value={displayLink.detentora_b} mono={false} />
                <Field label="SITE STATUS B" value={displayLink.site_status_b} mono={false} />
              </div>
              <div className="grid grid-cols-6 gap-3 border-t border-line/60 pt-3">
                <Field label="PRE-PO#" value={displayLink.pre_po} />
                <Field label="DU HW PTA" value={displayLink.du_hw_pta} />
                <Field label="DU HW PTB" value={displayLink.du_hw_ptb} />
                <Field label="SURVEY PO" value={displayLink.survey_po} />
                <Field label="SCOPE" value={displayLink.scope} mono={false} />
                <Field label="TARGET" value={displayLink.target} mono={false} />
              </div>
            </div>
          </fieldset>

          {/* ---------- Status & Fornecedor (ordem fixa) ---------- */}
          <fieldset className="mb-6">
            <SectionTitle>Status &amp; Fornecedor</SectionTitle>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Preliminary Status" value={mainStatusLabel} mono={false} />
                <Field label="Preliminary Status Detail" value={detailLabel} mono={false} />
                <Field label="Owner" value={owner} mono={false} />
              </div>

              <div className="border-t border-line/60 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRemarks(true)}
                  className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-[13px] text-muted hover:text-ink"
                >
                  💬 Preliminary Remark
                  {displayLink.preliminary_remark && (
                    <span className="rounded-full bg-accent/15 px-1.5 text-[11px] text-accent">tem observações</span>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 border-t border-line/60 pt-3">
                <Field label="SUPPLIER" value={displayLink.supplier} mono={false} />
                <Field label="PO SUPPLIER" value={displayLink.po_supplier} mono={false} />
                <Field label="PO Remark" value={displayLink.po_remark} mono={false} />
                <Field label="Supplier Scope" value={displayLink.supplier_scope} mono={false} />
              </div>

              <div className="border-t border-line/60 pt-3">
                <Field label="PR Supplier" value={displayLink.pr_supplier} mono={false} />
              </div>

              <div className="border-t border-line pt-3">
                <span className="mb-2 block text-[11px] uppercase tracking-wide text-muted">Pré Preliminar</span>
                <div className="grid grid-cols-4 gap-3">
                  <Field label="PO DATE" value={displayLink.po_date} />
                  <Field label="DU CREATION" value={displayLink.du_creation} />
                  <Field label="SAR / PE PTA" value={displayLink.sar_pe_pta} mono={false} />
                  <Field label="SAR / PE PTB" value={displayLink.sar_pe_ptb} mono={false} />
                </div>
              </div>

              {displayLink.previous_status_detail && (
                <div className="border-t border-line/60 pt-3">
                  <Field
                    label="Previous Status Detail (etapa anterior à mudança)"
                    value={displayLink.previous_status_detail}
                    mono={false}
                  />
                </div>
              )}
            </div>
          </fieldset>

          {/* ---------- Cronograma: todas as datas, no fim ---------- */}
          <fieldset className="mb-2">
            <SectionTitle>Cronograma — Todas as Datas</SectionTitle>
            <MilestoneDatesTable schema={schema} link={displayLink} />
          </fieldset>
        </div>
      </div>

      {showRemarks && (
        <RemarkModal link={displayLink} onClose={() => setShowRemarks(false)} onSaved={handleRemarkSaved} />
      )}

      {showPipeline && <PipelineModal onClose={() => setShowPipeline(false)} />}

      {showSwapB && (
        <SwapSiteBModal
          link={displayLink}
          onClose={() => setShowSwapB(false)}
          onDone={(updated) => updated && handleRemarkSaved(updated)}
        />
      )}
    </div>
  );
}
