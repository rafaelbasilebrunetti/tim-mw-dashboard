import PipelineDiagram from "./PipelineDiagram";

/**
 * Envelope de modal para o PipelineDiagram - é o "local de fácil
 * visualização" pedido: acessível pelo botão "Ver fluxograma" tanto no
 * cabeçalho do dashboard (referência geral) quanto de dentro do detalhe
 * de um site (referência no contexto daquele link).
 */
export default function PipelineModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-mono text-[15px] text-ink">Fluxograma do processo</h2>
            <p className="text-[12px] text-muted">Do PO até o SSR, com os caminhos de Prospection e Simulation</p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-muted hover:bg-base hover:text-ink" aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <PipelineDiagram />
        </div>
      </div>
    </div>
  );
}
