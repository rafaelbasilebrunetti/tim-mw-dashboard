/**
 * timKey.js
 * ---------
 * Regras de identidade dos enlaces (definidas pelo processo):
 *
 * TIM KEY - referência do cliente, imutável, SEMPRE no formato
 * xxxx.xxxxxx (4 dígitos, ponto, 6 dígitos). A base tem valores
 * quebrados ("2025.00061", "2025") porque o Excel trata a chave como
 * número e descarta zeros à DIREITA da parte decimal. Isso torna a
 * recuperação exata: só zeros podem ter sido perdidos, então completar
 * com zeros à direita até 6 dígitos reconstrói o valor original
 * ("2025.00061" -> "2025.000610"; "2025" -> "2025.000000").
 *
 * DU ID VIRTUAL - referência interna do enlace. Nasce igual à TIM KEY.
 * A cada LOS Block, a ponta B é trocada e uma nova DU Virtual é criada
 * com o sufixo .LD_x ("2025.000610.LD_1", depois .LD_2...). A TIM KEY
 * não muda nunca; quem versiona é a DU Virtual.
 */

const KEY_PATTERN = /^(\d{4})(?:[.,](\d{1,6}))?$/;
const LD_SUFFIX = /^(.*?)\.(LD_\d+)$/i;

/**
 * Normaliza uma TIM Key para xxxx.xxxxxx. Valores que não seguem o
 * padrão (texto livre, vazio) voltam como estão - nunca inventamos
 * uma chave.
 */
export function formatTimKey(raw) {
  const text = String(raw ?? "").trim();
  const match = KEY_PATTERN.exec(text);
  if (!match) return text;
  const [, year, fraction = ""] = match;
  return `${year}.${fraction.padEnd(6, "0")}`;
}

/**
 * Normaliza uma DU Virtual: formata a base como TIM Key e preserva o
 * sufixo .LD_x se existir.
 */
export function formatDuVirtual(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return text;
  const match = LD_SUFFIX.exec(text);
  if (match) return `${formatTimKey(match[1])}.${match[2].toUpperCase()}`;
  return formatTimKey(text);
}

/**
 * Próxima DU Virtual após um LOS Block: base (TIM Key normalizada)
 * + .LD_{n+1}. "2025.000610" -> "2025.000610.LD_1";
 * "2025.000610.LD_1" -> "2025.000610.LD_2".
 */
export function nextDuVirtual(currentDu, timKey) {
  const current = String(currentDu ?? "").trim();
  const match = LD_SUFFIX.exec(current);
  const base = formatTimKey(match ? match[1] : current || timKey);
  const n = match ? parseInt(match[2].slice(3), 10) + 1 : 1;
  return `${base}.LD_${n}`;
}

/**
 * Normaliza os campos de identidade de um registro vindo da API.
 * Aplicada na camada api.js, para toda a dashboard (tabela, filtros,
 * busca, detalhe, export CSV) enxergar os valores já no padrão.
 */
export function normalizeRecord(record) {
  if (!record || typeof record !== "object" || !("tim_key" in record)) return record;
  const out = { ...record };
  if (out.tim_key) out.tim_key = formatTimKey(out.tim_key);
  if (out.du_id_virtual) out.du_id_virtual = formatDuVirtual(out.du_id_virtual);
  return out;
}
