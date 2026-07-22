// Fonte única da hierarquia de status "Preliminary Status" (etapa
// principal) / "Preliminary Status Detail" (sub-etapa). Os campos
// correspondentes no registro (preliminary_status / preliminary_status_detail)
// são texto livre no backend - este arquivo formaliza a ordem e os
// rótulos para desenhar o fluxograma (StatusFlow.jsx).

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
