/**
 * exportData.js
 * -------------
 * Gera o arquivo de exportação seguindo exatamente o padrão definido em
 * config/templates/TIM_MW_SP_Preliminary_Report_-_Template.csv:
 *
 *   - mesma ORDEM de colunas   -> campo "index" do schema
 *   - mesmos TÍTULOS de coluna -> campo "csv_header" do schema
 *   - separador ";" e BOM UTF-8 (o Excel PT-BR precisa dos dois para
 *     abrir o arquivo com acentos e colunas corretas ao dar duplo clique)
 *
 * É o mesmo contrato que o backend usa para regravar a planilha principal
 * (ver spreadsheet_store.write_records), então o arquivo exportado tem
 * exatamente as colunas que o dashboard reconhece. Se alguém editar o CSV
 * template e rodar `python schema_loader.py`, o export acompanha sozinho —
 * nada aqui conhece nomes de coluna.
 */

const DELIMITER = ";";
const BOM = "\uFEFF";
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Formatos de data oferecidos na tela de exportação. */
export const DATE_FORMATS = {
  br: { label: "31/12/2026", hint: "padrão brasileiro, para abrir no Excel" },
  iso: { label: "2026-12-31", hint: "padrão ISO, para reimportar em outra ferramenta" },
};

function formatDate(value, dateFormat) {
  const match = ISO_DATE.exec(value.trim());
  // Data em formato inesperado sai como está: melhor exportar o valor cru
  // do que descartar silenciosamente uma informação que o usuário digitou.
  if (!match) return value.trim();
  const [, year, month, day] = match;
  return dateFormat === "iso" ? `${year}-${month}-${day}` : `${day}/${month}/${year}`;
}

function formatValue(value, field, dateFormat) {
  if (value === null || value === undefined) return "";

  const text = String(value).trim();
  if (text === "") return "";

  if (field.type === "date") return formatDate(text, dateFormat);

  // Latitude/longitude com vírgula decimal: é o que o Excel PT-BR entende
  // como número. Como o separador de coluna é ";", não há ambiguidade.
  if (field.type === "float") return text.replace(".", ",");

  return text;
}

/** Escapa uma célula segundo o RFC 4180 (adaptado para o separador ";"). */
function escapeCell(text) {
  if (text === "") return "";
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Monta o conteúdo do CSV. Exposta separadamente de exportToCsv para
 * poder ser testada sem depender do DOM.
 */
export function buildCsv(schema, records, { dateFormat = "br" } = {}) {
  const fields = [...schema].sort((a, b) => a.index - b.index);

  const header = fields.map((field) => escapeCell(field.csv_header.trim())).join(DELIMITER);

  const rows = records.map((record) =>
    fields
      .map((field) => escapeCell(formatValue(record[field.internal_name], field, dateFormat)))
      .join(DELIMITER)
  );

  // CRLF: o Excel para Windows é o destino principal destes arquivos.
  return BOM + [header, ...rows].join("\r\n") + "\r\n";
}

/** TIM_MW_SP_Preliminary_Report_2026-07-22_1432.csv */
export function buildFileName(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `TIM_MW_SP_Preliminary_Report_${date}_${time}.csv`;
}

/**
 * Dispara o download de um blob. Compartilhado pelo CSV montado aqui e
 * pelo .xlsx formatado que vem pronto do backend.
 */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Sem isso o blob fica preso na memória da aba até o reload.
  URL.revokeObjectURL(url);
}

/** Monta o CSV e dispara o download no navegador. */
export function exportToCsv(schema, records, options = {}) {
  const content = buildCsv(schema, records, options);
  const fileName = buildFileName();
  saveBlob(new Blob([content], { type: "text/csv;charset=utf-8;" }), fileName);
  return { fileName, rows: records.length };
}
