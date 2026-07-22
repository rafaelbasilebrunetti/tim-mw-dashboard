import { useEffect } from "react";

/**
 * Fecha um popover (dropdown de filtro, menu de exportação) quando o
 * usuário clica fora dele ou aperta Esc.
 *
 * ref:       elemento raiz do popover — precisa envolver TAMBÉM o botão
 *            que abre, senão o próprio clique de abertura fecha na hora.
 * open:      só escuta os eventos enquanto está aberto.
 * onDismiss: chamado quando deve fechar.
 */
export function useDismiss(ref, open, onDismiss) {
  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) onDismiss();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") onDismiss();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ref, open, onDismiss]);
}
