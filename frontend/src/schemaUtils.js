// Ordem fixa das etapas do pipeline (usada pela Trilha de Marcos).
// Vem do agrupamento milestone_group que o backend já calcula a partir
// dos sufixos (P)/(R) do CSV - aqui só fixamos a ordem de exibição.
export const MILESTONE_ORDER = [
  "LOS Simulation",
  "LD",
  "Survey on Field",
  "LOS on Field",
  "LOS Report Supplier",
  "LOS Analysis",
  "TSSR Analysis",
  "PPI",
  "PPI Customer Approval",
];

// Campos com uma lista fixa de opções em vez de texto livre. Usado por
// FieldInput.jsx para decidir entre <select> e <input>.
export const SELECT_OPTIONS = {
  supplier: ["BEHIVE", "PROTENG", "CELPLAN"],
  los_result: ["Prospection", "Simulation", "Block"],
  scope: ["NEW LINK", "SWAP"],
};

// Campos removidos da dashboard (pedido do processo): continuam existindo
// no schema, no banco e na planilha - só não aparecem em nenhuma tela.
// Hold saiu porque a informação já vive em Preliminary Status Detail
// (00.1/03.0/04.0/06.1); Status Qualificação saiu do processo.
export const HIDDEN_FIELDS = new Set(["hold", "status_qualificacao"]);

const IDENTIFICATION_FIELDS = new Set([
  "oc", "tim_key", "hop", "site_a", "end_id_a", "site_b", "end_id_b",
  "dd_a", "dd_b", "infra_type_a", "infra_type_b", "site_status_a",
  "site_status_b", "municipio_a", "municipio_b", "detentora_a",
  "detentora_b", "end_id_ptb_2", "end_id_ptb_3", "end_id_ptb_4",
  "perfil", "du_id_preliminar", "du_id_virtual", "pre_po", "du_hw_pta",
  "du_hw_ptb", "ano", "target", "target_tim", "projeto_tim",
  "survey_po", "scope",
]);

/**
 * Agrupa os campos do schema (vindos de GET /api/schema) em seções
 * legíveis para o formulário dinâmico:
 *   Identificação | Localização | Status & Fornecedor | Cronograma
 */
export function groupSchema(schema) {
  const groups = {
    "Identificação": [],
    "Localização": [],
    "Status & Fornecedor": [],
    "Cronograma (Planejado / Realizado)": [],
  };

  for (const field of schema) {
    if (HIDDEN_FIELDS.has(field.internal_name)) continue;
    if (field.milestone_group) {
      groups["Cronograma (Planejado / Realizado)"].push(field);
    } else if (field.type === "float") {
      groups["Localização"].push(field);
    } else if (IDENTIFICATION_FIELDS.has(field.internal_name)) {
      groups["Identificação"].push(field);
    } else {
      groups["Status & Fornecedor"].push(field);
    }
  }

  return groups;
}

/**
 * Agrupa os campos de cronograma do schema em pares Planejado/Realizado
 * por milestone_group (ex: "LOS Simulation" -> { planned: "los_simulation_p",
 * realized: "los_simulation_r" }), na ordem em que aparecem na planilha
 * (field.index). Fonte única usada por buildMilestoneTrack, pela tabela
 * de leitura em SiteDetailModal.jsx e pela tabela editável em
 * LinkFormModal.jsx - mantenha os três em sincronia se essa forma mudar.
 */
export function buildMilestoneGroups(schema) {
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
  return groups;
}

/**
 * Constrói a trilha de marcos para uma linha: para cada etapa em
 * MILESTONE_ORDER, olha os campos _p e _r correspondentes no registro
 * e decide o estado: 'done' (tem realizado), 'planned' (só planejado),
 * 'pending' (nenhum dos dois).
 */
export function buildMilestoneTrack(schema, record) {
  const byName = new Map(buildMilestoneGroups(schema).map((g) => [g.name, g]));

  return MILESTONE_ORDER.filter((name) => byName.has(name)).map((name) => {
    const { planned, realized } = byName.get(name);
    const plannedValue = planned ? record[planned] : null;
    const realizedValue = realized ? record[realized] : null;
    let status = "pending";
    if (realizedValue) status = "done";
    else if (plannedValue) status = "planned";
    return { name, status, plannedValue, realizedValue };
  });
}

/**
 * Detecta valores de data claramente inválidos vindos da planilha: texto
 * que não é uma data ISO reconhecível (ex: "#REF!", erro de fórmula do
 * Excel) ou uma data de época (ano < 1990) - artefato comum de subtração
 * de células vazias no Excel (ex: "01/04/1900"). Usado para destacar essas
 * células na tabela editável de cronograma (LinkFormModal.jsx), não para
 * bloquear nada - a limpeza continua manual.
 */
export function isSuspiciousDateValue(value) {
  const str = String(value ?? "").trim();
  if (!str) return false;
  const match = /^(\d{4})-\d{2}-\d{2}/.exec(str);
  if (!match) return true;
  return Number(match[1]) < 1990;
}

export function statusColor(status) {
  const key = (status || "").toLowerCase();
  if (key.includes("hold") || key.includes("bloque")) return "red";
  if (key.includes("conclu") || key.includes("aprova")) return "green";
  if (key.includes("andamento") || key.includes("progress")) return "amber";
  return "gray";
}
