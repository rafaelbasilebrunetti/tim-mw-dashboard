// Fonte única da hierarquia de status "Preliminary Status" (etapa
// principal) / "Preliminary Status Detail" (sub-etapa). Os campos
// correspondentes no registro (preliminary_status / preliminary_status_detail)
// são texto livre no backend - este arquivo formaliza a ordem e os
// rótulos para desenhar o fluxograma (StatusFlow.jsx).
//
// Espelha backend/stage_flow.py (ordem/rótulos das etapas e os códigos
// pulados nos caminhos Simulation/SWAP) - mantenha os dois em sincronia
// se a ordem, os rótulos, ou as regras de bifurcação mudarem.

export const MAIN_STEPS = [
  { code: "00", label: "Hold/Cancelled" },
  { code: "01", label: "PO / DU" },
  { code: "02", label: "LOS Simulation / Link Design" },
  { code: "03", label: "LOS / Survey On Field" },
  { code: "04", label: "PPI" },
  { code: "05", label: "Customer Approval" },
  { code: "06", label: "Preliminary Finished" },
];

export const STATUS_DETAILS = [
  { code: "00.0", label: "Cancelled", parentCode: "00" },
  { code: "00.1", label: "Hold", parentCode: "00" },
  { code: "01.1", label: "Pending Preliminary PO", parentCode: "01" },
  { code: "01.2", label: "Pending DU Creation", parentCode: "01" },
  { code: "02.1", label: "Pending Customer Document for LOS", parentCode: "02" },
  { code: "02.2", label: "LOS Simulation Development", parentCode: "02" },
  { code: "02.3", label: "Customer LOS Simulation Analysis", parentCode: "02" },
  { code: "02.4", label: "Link Design Development", parentCode: "02" },
  { code: "03.0", label: "Survey Hold", parentCode: "03" },
  { code: "03.1", label: "LOS/Survey On Field", parentCode: "03" },
  { code: "03.2", label: "Pending LOS/TSS Report", parentCode: "03" },
  { code: "03.3", label: "LoS Analysis", parentCode: "03" },
  { code: "04.0", label: "PPI Hold", parentCode: "04" },
  { code: "04.1", label: "PPI Development", parentCode: "04" },
  { code: "05.1", label: "PPI Customer Approval", parentCode: "05" },
  { code: "06.0", label: "Pending SSR", parentCode: "06" },
  { code: "06.1", label: "SSR Hold", parentCode: "06" },
  { code: "06.2", label: "Preliminary Finished", parentCode: "06" },
];

// Owner responsável por cada sub-etapa (Regra fixa do processo - não vem
// do banco). Etapas sem entrada aqui (ex: 06.1-SSR Hold, 06.2-Preliminary
// Finished) não têm um owner definido pela regra; a tela mostra "—".
export const OWNER_BY_DETAIL_CODE = {
  "00.0": "Customer",
  "00.1": "Customer",
  "01.1": "KA",
  "01.2": "KA",
  "02.1": "Customer",
  "02.2": "P&DC",
  "02.3": "Customer",
  "02.4": "P&DC",
  "03.0": "RDE",
  "03.1": "RDE/Supplier",
  "03.2": "RDE/Supplier",
  "03.3": "RDE/Supplier",
  "04.0": "RDE",
  "04.1": "P&DC",
  "05.1": "Customer",
  "06.0": "P&DC",
};

/** Owner da regra fixa para um código de sub-etapa, ou null se não houver. */
export function resolveOwner(detailCode) {
  return OWNER_BY_DETAIL_CODE[detailCode] || null;
}

/**
 * Rótulo da etapa principal (ex: "02-LOS Simulation / Link Design") a
 * partir do código de SUB-etapa. Preliminary Status na tela nunca é
 * digitado à parte - ele sempre segue o que Preliminary Status Detail
 * diz, via o parentCode declarado em STATUS_DETAILS.
 */
export function mainLabelForDetailCode(detailCode) {
  const detail = STATUS_DETAILS.find((d) => d.code === detailCode);
  if (!detail) return null;
  const main = MAIN_STEPS.find((m) => m.code === detail.parentCode);
  return main ? `${main.code}-${main.label}` : null;
}

function extractMainCode(text) {
  const match = /^(\d{2})/.exec(String(text || "").trim());
  return match ? match[1] : null;
}

/**
 * Extrai um código de sub-etapa válido (ex: "02.3") do início de um
 * texto, ou null se não bater com nenhum código conhecido de
 * STATUS_DETAILS. Usado pelo modal de transição de etapa para resolver
 * a etapa atual/anterior de um site a partir dos campos crus.
 */
export function extractCode(text) {
  const match = /^(\d{2}\.\d)/.exec(String(text || "").trim());
  const code = match ? match[1] : null;
  return code && STATUS_DETAILS.some((d) => d.code === code) ? code : null;
}

/**
 * Resolve a posição de um site no fluxo de status a partir dos campos
 * crus (preliminary_status / preliminary_status_detail). Os dados reais
 * às vezes têm um código de sub-etapa (ex: "04.0-PPI Hold") direto no
 * campo principal - por isso o código de 2 dígitos é extraído de
 * qualquer um dos dois campos, o que vier primeiro.
 */
export function resolveStatusFlow(mainStatus, detailStatus) {
  const mainCode = extractMainCode(mainStatus) || extractMainCode(detailStatus);
  const mainIndex = mainCode ? MAIN_STEPS.findIndex((s) => s.code === mainCode) : -1;

  const detailSource = String(detailStatus || mainStatus || "").trim();
  const detailMatch = STATUS_DETAILS.find((d) => detailSource.startsWith(d.code));

  return {
    mainCode,
    mainIndex,
    detailCode: detailMatch ? detailMatch.code : null,
    detailLabel: detailMatch ? `${detailMatch.code}-${detailMatch.label}` : detailSource || null,
  };
}

// Um site só é considerado "Concluído" quando a data de PPI Customer
// Approval - Realizado está preenchida. Enquanto isso, o Status Detail
// não deveria passar de 06.0-Pending SSR - se já estiver em 06.1/06.2
// sem essa data, é uma inconsistência de dados (sinalizada, não escondida).
const COMPLETION_THRESHOLD = "06.0";

export function resolveCompletion(link) {
  const { detailCode } = resolveStatusFlow(link.preliminary_status, link.preliminary_status_detail);
  const hasApprovalDate = Boolean(link.ppi_customer_approval_r);
  const pastThreshold = Boolean(detailCode) && detailCode > COMPLETION_THRESHOLD;

  return {
    completed: hasApprovalDate,
    label: hasApprovalDate ? "Concluído" : "Em Andamento",
    inconsistent: !hasApprovalDate && pastThreshold,
  };
}

/* ------------------------------------------------------------------ */
/* Trilha detalhada (Preliminary Status Detail)                        */
/* ------------------------------------------------------------------ */

// Sub-etapas de interrupção: NÃO aparecem como nós da trilha detalhada.
// Cada uma vira um marcador de parada + um chip para marcar/desmarcar.
export const HOLD_DETAIL_CODES = ["00.0", "00.1", "03.0", "04.0", "06.1"];

// Ordem dos nós da trilha detalhada (fluxo normal, sem interrupções).
export const DETAIL_TRACK = [
  "01.1", "01.2", "02.1", "02.2", "02.3", "02.4",
  "03.1", "03.2", "03.3", "04.1", "05.1", "06.0", "06.2",
];

// Etapas que só existem no caminho COM ida a campo (resultado do LOS =
// Prospection). Quando o resultado é Simulation, o fluxograma pula essas
// etapas (TSSR Execution, sem visita) e a trilha as esconde.
export const FIELD_ONLY_CODES = new Set(["03.1", "03.2"]);

export const LOS_RESULT_OPTIONS = ["Prospection", "Simulation", "Block"];

// Etapas que não existem no caminho SWAP: um enlace SWAP pula de 01.2
// (DU Creation) direto para 04.1 (PPI Development) pelo atalho "TSSR
// Execution" - as mesmas etapas de LOS/documentação/campo do caminho
// Simulation, mais as de LOS Simulation/Link Design (02.x). Espelha
// SWAP_SKIP_CODES em backend/stage_flow.py - mantenha os dois em sincronia.
export const SWAP_SKIP_CODES = new Set([
  "02.1", "02.2", "02.3", "02.4", "03.1", "03.2", "03.3",
]);

// Onde cada interrupção "encaixa" na trilha: o marcador de parada entra
// no lugar da etapa indicada (tudo antes dela fica concluído).
// Ex. do processo: "PPI Hold mostra todas as etapas até o 04.0".
const HOLD_STOP_AT = { "03.0": "03.1", "04.0": "04.1", "06.1": "06.2" };

// Datas mostradas embaixo de cada nó quando a etapa foi PASSADA.
// Mapeamento definido pelo processo (colunas AU..BT da planilha):
export const DETAIL_DATE_FIELDS = {
  "01.1": [{ field: "po_date", label: "PO Date" }],
  "01.2": [{ field: "du_creation", label: "DU Creation" }],
  "02.1": [
    { field: "sar_pe_pta", label: "SAR/PE PTA" },
    { field: "sar_pe_ptb", label: "SAR/PE PTB" },
  ],
  "02.2": [{ field: "los_simulation_r", label: "LOS Simulation" }],
  "02.3": [], // sem data
  "02.4": [{ field: "ld_r", label: "LD" }],
  "03.1": [{ field: "survey_on_field_r", label: "Survey on Field" }],
  "03.2": [
    { field: "tssr_supplier_r", label: "TSSR Supplier" },
    { field: "los_report_supplier_r", label: "LOS Report" },
  ],
  "03.3": [{ field: "los_analysis_r", label: "LOS Analysis" }],
  "04.1": [{ field: "ppi_r", label: "PPI" }],
  "05.1": [{ field: "ppi_customer_approval_r", label: "PPI Approval" }],
  "06.0": [
    { field: "ssr_pta_r", label: "SSR PTA" },
    { field: "ssr_ptb_r", label: "SSR PTB" },
  ],
  "06.2": [],
};

/** "2026-02-21" -> "21/02/2026"; qualquer outro texto sai como está. */
export function formatDateBR(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || "").trim());
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || "").trim();
}

export function detailLabelOf(code) {
  const detail = STATUS_DETAILS.find((d) => d.code === code);
  return detail ? `${detail.code}-${detail.label}` : code;
}

/**
 * Monta a trilha detalhada de um site:
 *   nodes:    [{ code, label, state: done|current|future, dates:[{label,value}] }]
 *   holdStop: { code, label, atIndex } quando a etapa atual é uma
 *             interrupção - o marcador entra em atIndex e a trilha para ali
 *   losResult / fieldSkipped: estado da bifurcação do fluxograma (Simulation)
 *   isSwap / swapSkipped: estado da bifurcação do fluxograma (SCOPE=SWAP)
 *   scopeInconsistent: true quando a etapa atual/de referência do site é
 *     uma etapa que não existe no caminho SWAP (ex: 02.2) - sinalizada,
 *     não escondida (mesmo padrão de resolveCompletion).
 *
 * As datas só são preenchidas em etapas passadas (done) - regra do
 * processo: "as datas devem aparecer apenas quando a etapa é passada".
 */
export function buildDetailTrack(link) {
  const losResult = String(link.los_result || "").trim();
  const fieldSkipped = losResult === "Simulation";
  const isSwap = String(link.scope || "").trim() === "SWAP";
  const codes = DETAIL_TRACK.filter((c) => {
    if (isSwap) return !SWAP_SKIP_CODES.has(c);
    return !(fieldSkipped && FIELD_ONLY_CODES.has(c));
  });

  const currentCode =
    extractCode(link.preliminary_status_detail) || extractCode(link.preliminary_status);
  const isHold = Boolean(currentCode) && HOLD_DETAIL_CODES.includes(currentCode);

  // Etapa de referência: onde a trilha "está". Para interrupções, é a
  // etapa em cujo lugar o marcador de parada entra.
  let refCode = currentCode;
  if (isHold) {
    refCode =
      currentCode === "00.0" || currentCode === "00.1"
        ? extractCode(link.previous_status_detail)
        : HOLD_STOP_AT[currentCode];
  }

  const scopeInconsistent = isSwap && Boolean(refCode) && SWAP_SKIP_CODES.has(refCode);

  // Se a etapa de referência não está visível (ex: 03.1 escondida no
  // caminho Simulation, ou 02.2 escondida no caminho SWAP), ancora na
  // próxima etapa visível do fluxo.
  let refIndex = refCode ? codes.indexOf(refCode) : -1;
  if (refCode && refIndex === -1) {
    refIndex = codes.findIndex((c) => c > refCode);
    if (refIndex === -1) refIndex = codes.length;
  }

  const nodes = codes.map((code, i) => {
    let state = "future";
    if (refIndex >= 0) {
      if (i < refIndex) state = "done";
      else if (i === refIndex && !isHold) state = "current";
    }
    const dates =
      state === "done" || state === "current"
        ? (DETAIL_DATE_FIELDS[code] || [])
            .map(({ field, label }) => ({ label, value: link[field] }))
            .filter((d) => d.value)
        : [];
    return { code, label: detailLabelOf(code), state, dates };
  });

  return {
    nodes,
    holdStop: isHold
      ? { code: currentCode, label: detailLabelOf(currentCode), atIndex: Math.max(refIndex, 0) }
      : null,
    losResult,
    fieldSkipped,
    isSwap,
    swapSkipped: isSwap,
    scopeInconsistent,
    scopeInconsistentCode: scopeInconsistent ? refCode : null,
  };
}
