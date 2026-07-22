import { useState } from "react";
import { api } from "../api";

/**
 * Modal de comentários do Preliminary Remark.
 *
 * Continua sendo o MESMO campo (preliminary_remark) que já existia no
 * registro - isso aqui só muda como ele é lido e editado: em vez de um
 * texto solto no formulário, cada entrada nova vira uma linha com data,
 * empilhada como um histórico. Entradas antigas (texto livre, sem esse
 * formato) aparecem como uma única linha sem data.
 */

const ENTRY_SEPARATOR = "\n\n";
const ENTRY_PREFIX = /^\[(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})\]\s*/;

function parseEntries(rawText) {
  if (!rawText || !rawText.trim()) return [];
  return rawText
    .split(ENTRY_SEPARATOR)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const match = ENTRY_PREFIX.exec(chunk);
      return match
        ? { date: match[1], text: chunk.slice(match[0].length) }
        : { date: null, text: chunk };
    });
}

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function RemarkModal({ link, onClose, onSaved }) {
  const [rawText, setRawText] = useState(link.preliminary_remark || "");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const entries = parseEntries(rawText);

  async function handleAdd() {
    const text = draft.trim();
    if (!text) return;

    const entry = `[${timestamp()}] ${text}`;
    const nextText = rawText.trim() ? `${rawText.trim()}${ENTRY_SEPARATOR}${entry}` : entry;

    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateLink(link.id, { preliminary_remark: nextText });
      setRawText(nextText);
      setDraft("");
      onSaved?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-mono text-[15px] text-ink">Preliminary Remark</h2>
            <p className="text-[12px] text-muted">{link.tim_key || `#${link.id}`}</p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-muted hover:bg-base hover:text-ink" aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {entries.length === 0 ? (
            <p className="text-[13px] text-muted">Nenhuma observação registrada ainda.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {entries.map((entry, i) => (
                <li key={i} className="rounded-lg border border-line bg-base px-3 py-2.5">
                  {entry.date && (
                    <span className="mb-1 block font-mono text-[11px] text-muted">{entry.date}</span>
                  )}
                  <p className="whitespace-pre-wrap text-[13px] text-ink">{entry.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line px-5 py-4">
          {error && <p className="mb-2 text-[12px] text-status-hold">{error}</p>}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Adicionar observação..."
            rows={3}
            className="w-full resize-none rounded-md border border-line bg-base px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !draft.trim()}
              className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-base disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Adicionar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
