import { useState } from "react";
import { api } from "../api";

export default function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }

    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err.status === 401 ? "Senha atual incorreta." : err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-mono text-[15px] text-ink">Trocar senha</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-muted hover:bg-base hover:text-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="px-5 py-6">
            <p className="text-[13px] text-ink">
              Senha alterada com sucesso. Ela já vale para os próximos logins.
            </p>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-base"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4">
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted">Senha atual</span>
              <input
                type="password"
                autoFocus
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-[12px] text-muted">Nova senha</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-[12px] text-muted">Confirmar nova senha</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-line bg-base px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </label>

            {error && (
              <p className="mt-3 rounded-md border border-status-hold/40 bg-status-hold/10 px-3 py-2 text-[12px] text-status-hold">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-line px-3.5 py-1.5 text-[13px] text-muted hover:text-ink"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-base disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar nova senha"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
