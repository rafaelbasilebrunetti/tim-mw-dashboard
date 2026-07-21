import { useState } from "react";
import { api } from "../api";

export default function LoginPage({ onAuthenticated }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.login(password);
      onAuthenticated();
    } catch (err) {
      setError(err.status === 401 ? "Senha incorreta." : "Não foi possível entrar. Verifique se o backend está rodando.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-line bg-surface p-6"
      >
        <h1 className="font-mono text-[15px] tracking-tight text-ink">
          TIM MW <span className="text-accent">·</span> SP Preliminary Report
        </h1>
        <p className="mt-1 text-[12px] text-muted">Digite a senha para acessar o dashboard.</p>

        <input
          type="password"
          autoFocus
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-5 w-full rounded-md border border-line bg-base px-3 py-2 text-[13px] text-ink outline-none focus:border-accent"
        />

        {error && (
          <p className="mt-3 rounded-md border border-status-hold/40 bg-status-hold/10 px-3 py-2 text-[12px] text-status-hold">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !password}
          className="mt-4 w-full rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-base disabled:opacity-50"
        >
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
