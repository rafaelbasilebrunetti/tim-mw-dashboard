/**
 * PipelineDiagram.jsx
 * -------------------
 * Fluxograma de referência do processo completo, do PO até o SSR.
 * Estático (não lê nada do banco) - existe para consulta rápida de "o que
 * vem depois de X" e "o que acontece se Y for reprovado/bloqueado", que
 * hoje só vive na cabeça de quem já rodou o processo várias vezes.
 *
 * Três bifurcações que o fluxo sequencial de status (stage_flow.py) não
 * modela porque são sobre COMO se chega no dado, não sobre datas:
 *
 *   1) Logo após "PO"/"DU Creation": se o SCOPE do link (coluna AJ) for
 *      "SWAP", o enlace pula direto para "TSSR Execution" - o mesmo
 *      atalho da bifurcação (3) - sem passar por SAR/PE, LOS Simulation,
 *      LOS Analysis nem campo. Se for "NEW LINK", segue o fluxo normal.
 *
 *   2) Depois de "LOS Simulation": se o resultado for "LOS Block", o
 *      processo volta para SAR/PE (o documento precisa ser refeito) em
 *      vez de seguir para LOS Analysis.
 *
 *   3) Depois de "LOS Analysis": se o link for do tipo Prospection, segue
 *      o caminho longo (LD -> PR Supplier -> TSS -> TSSR e LOS em campo ->
 *      aprovação). Se for Simulation, pula direto para "TSSR Execution"
 *      (o mesmo relatório, mas sem visita a campo) e vai direto para PPI
 *      Development.
 *
 * Cores seguem a paleta do dashboard (tailwind.config.js): accent para
 * decisões, track-done para o caminho de aprovação, status-hold para
 * bloqueio/reprovação.
 */

const COLOR = {
  surface: "#171D21",
  line: "#262E33",
  ink: "#E8ECEE",
  muted: "#8B979E",
  accent: "#E8A23D",
  done: "#4FB286",
  hold: "#E2574C",
};

function Box({ x, y, w = 190, h = 46, label, sub, tone = "default" }) {
  const stroke = tone === "accent" ? COLOR.accent : tone === "done" ? COLOR.done : COLOR.line;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={COLOR.surface} stroke={stroke} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 3 : h / 2 + 5)} textAnchor="middle" fontSize="12.5" fill={COLOR.ink} fontFamily="JetBrains Mono, ui-monospace, monospace">
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fontSize="10" fill={COLOR.muted}>
          {sub}
        </text>
      )}
    </g>
  );
}

function Arrow({ d, color = COLOR.muted, markerId }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={1.5} markerEnd={`url(#${markerId})`} />;
}

function EdgeLabel({ x, y, text, color = COLOR.muted }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize="10.5" fill={color} fontStyle="italic">
      {text}
    </text>
  );
}

export default function PipelineDiagram() {
  return (
    <div className="overflow-auto rounded-lg border border-line bg-base p-4">
      <svg viewBox="0 0 920 1180" width="100%" style={{ minWidth: 760 }}>
        <defs>
          {["muted", "accent", "done", "hold"].map((key) => (
            <marker
              key={key}
              id={`arrow-${key}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill={COLOR[key]} />
            </marker>
          ))}
        </defs>

        {/* ---------- espinha principal ---------- */}
        <Box x={365} y={20} label="PO" sub="chega" />
        <Box x={365} y={100} label="DU Creation" />
        <Box x={365} y={180} label="SAR / PE" sub="documentos para LOS" />
        <Box x={365} y={260} label="LOS Simulation" tone="accent" />
        <Arrow d="M460,66 V100" markerId="arrow-muted" />
        <Arrow d="M460,146 V180" markerId="arrow-muted" />
        <Arrow d="M460,226 V260" markerId="arrow-muted" />
        <EdgeLabel x={545} y={163} text="NEW LINK" />

        {/* bifurcação SCOPE=SWAP: do DU Creation direto para TSSR Execution,
            pulando SAR/PE, LOS Simulation, LOS Analysis e todo o campo */}
        <Arrow d="M555,123 H870 V463 H785" color={COLOR.accent} markerId="arrow-accent" />
        <EdgeLabel x={870} y={290} text="SWAP" color={COLOR.accent} />

        {/* loop: LOS Block volta para SAR/PE */}
        <Arrow d="M365,283 H300 V203 H365" color={COLOR.hold} markerId="arrow-hold" />
        <EdgeLabel x={300} y={243} text="LOS Block" color={COLOR.hold} />

        {/* LOS Simulation -> LOS Analysis (resultado OK: prospection ou simulation) */}
        <Box x={365} y={340} label="LOS Analysis" tone="accent" />
        <Arrow d="M460,306 V340" markerId="arrow-muted" />
        <EdgeLabel x={545} y={328} text="Prospection / Simulation" />

        {/* ---------- bifurcação pós LOS Analysis ---------- */}
        <Arrow d="M460,386 V410 H160 V440" markerId="arrow-done" color={COLOR.done} />
        <EdgeLabel x={160} y={430} text="Prospection" color={COLOR.done} />
        <Arrow d="M460,386 V410 H660 V440" markerId="arrow-accent" color={COLOR.accent} />
        <EdgeLabel x={660} y={430} text="Simulation" color={COLOR.accent} />

        {/* ---------- caminho A: Prospection (fluxo longo, com visita a campo) ---------- */}
        <Box x={65} y={440} w={190} label="LD" />
        <Box x={65} y={520} w={190} label="PR Supplier" />
        <Box x={65} y={600} w={190} label="TSS" sub="technical site survey" />
        <Box x={65} y={680} w={190} label="TSSR e LOS em campo" />
        <Box x={65} y={760} w={190} label="TSSR e LOS Approval" tone="accent" />
        <Arrow d="M160,486 V520" markerId="arrow-muted" />
        <Arrow d="M160,566 V600" markerId="arrow-muted" />
        <Arrow d="M160,646 V680" markerId="arrow-muted" />
        <Arrow d="M160,726 V760" markerId="arrow-muted" />

        {/* reprovado: volta para o supplier refazer a documentação */}
        <Arrow d="M65,783 H10 V703 H65" color={COLOR.hold} markerId="arrow-hold" />
        <EdgeLabel x={10} y={743} text="Reprovado" color={COLOR.hold} />

        {/* aprovado: segue para PPI Development */}
        <Arrow d="M160,806 V860 H430 V920" color={COLOR.done} markerId="arrow-done" />
        <EdgeLabel x={160} y={834} text="Aprovado" color={COLOR.done} />

        {/* ---------- caminho B: Simulation (pula visita a campo) ---------- */}
        <Box x={565} y={440} w={220} label="TSSR Execution" sub="TSSR sem visita a campo" tone="accent" />
        <text x={675} y={508} textAnchor="middle" fontSize="10" fill={COLOR.muted}>
          (pula PR Supplier, TSS, TSSR/LOS
        </text>
        <text x={675} y={520} textAnchor="middle" fontSize="10" fill={COLOR.muted}>
          em campo e a aprovação)
        </text>
        <Arrow d="M675,486 V860 H430 V920" markerId="arrow-muted" />

        {/* ---------- espinha final ---------- */}
        <Box x={335} y={920} w={250} label="PPI Development" />
        <Box x={335} y={1000} w={250} label="PPI Approval" />
        <Box x={335} y={1080} w={250} label="SSR" />
        <Arrow d="M460,966 V1000" markerId="arrow-muted" />
        <Arrow d="M460,1046 V1080" markerId="arrow-muted" />

        {/* ---------- legenda ---------- */}
        <g transform="translate(560,1080)">
          <line x1={0} y1={4} x2={22} y2={4} stroke={COLOR.hold} strokeWidth={2} />
          <text x={28} y={8} fontSize="11" fill={COLOR.muted}>Bloqueio / reprovação</text>
          <line x1={0} y1={24} x2={22} y2={24} stroke={COLOR.done} strokeWidth={2} />
          <text x={28} y={28} fontSize="11" fill={COLOR.muted}>Aprovação / prospection</text>
          <line x1={0} y1={44} x2={22} y2={44} stroke={COLOR.accent} strokeWidth={2} />
          <text x={28} y={48} fontSize="11" fill={COLOR.muted}>Decisão / simulation / swap</text>
        </g>
      </svg>
    </div>
  );
}
