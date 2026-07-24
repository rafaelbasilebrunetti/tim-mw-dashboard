"""
stage_flow.py
-------------
Fonte única da verdade do fluxo sequencial de etapas do "Preliminary
Status" / "Preliminary Status Detail" e das colunas de data que cada
etapa grava ao ser alcançada. Espelha a ordem/rótulos de
frontend/src/statusFlow.js (MAIN_STEPS/STATUS_DETAILS) - mantenha os
dois em sincronia se a ordem ou os rótulos mudarem.

Usado por routes.py para implementar a transição de etapas com duas
regras adicionais:

  Regra 1 - Hold/Cancelled a partir de qualquer etapa: 00.0 e 00.1 não
  fazem parte da progressão sequencial (ver HOLD_CODES) - são
  interrupções, não avanço, e não exigem data nenhuma.

  Regra 2 - Preenchimento retroativo ao pular etapas: ao avançar mais de
  um passo de uma vez, cada etapa intermediária pulada que normalmente
  gravaria uma data (ver STAGE_DATE_REQUIREMENTS) pode ter essa data
  preenchida retroativamente, ou deixada em branco.

  Regra 3 - Bifurcação por SCOPE (coluna AJ): um link com scope "SWAP"
  pula de 01.2 (Pending DU Creation) direto para 04.1 (PPI Development) -
  o atalho "TSSR Execution" do fluxograma. As etapas 02.1-02.4/03.1-03.3
  (ver SWAP_SKIP_CODES) simplesmente NÃO EXISTEM nesse caminho: diferente
  da Regra 2, elas não contam como "puladas com data retroativa a
  preencher" quando o scope é SWAP - stages_to_confirm recebe o scope e
  as exclui do cálculo. Um link "NEW LINK" segue o fluxo sequencial
  normal, sem esse atalho.
"""

import re

MAIN_STEPS = [
    {"code": "00", "label": "Hold/Cancelled"},
    {"code": "01", "label": "PO / DU"},
    {"code": "02", "label": "LOS Simulation / Link Design"},
    {"code": "03", "label": "LOS / Survey On Field"},
    {"code": "04", "label": "PPI"},
    {"code": "05", "label": "Customer Approval"},
    {"code": "06", "label": "Preliminary Finished"},
]

STATUS_DETAILS = [
    {"code": "00.0", "label": "Cancelled", "parent_code": "00"},
    {"code": "00.1", "label": "Hold", "parent_code": "00"},
    {"code": "01.1", "label": "Pending Preliminary PO", "parent_code": "01"},
    {"code": "01.2", "label": "Pending DU Creation", "parent_code": "01"},
    {"code": "02.1", "label": "Pending Customer Document for LOS", "parent_code": "02"},
    {"code": "02.2", "label": "LOS Simulation Development", "parent_code": "02"},
    {"code": "02.3", "label": "Customer LOS Simulation Analysis", "parent_code": "02"},
    {"code": "02.4", "label": "Link Design Development", "parent_code": "02"},
    {"code": "03.0", "label": "Survey Hold", "parent_code": "03"},
    {"code": "03.1", "label": "LOS/Survey On Field", "parent_code": "03"},
    {"code": "03.2", "label": "Pending LOS/TSS Report", "parent_code": "03"},
    {"code": "03.3", "label": "LoS Analysis", "parent_code": "03"},
    {"code": "04.0", "label": "PPI Hold", "parent_code": "04"},
    {"code": "04.1", "label": "PPI Development", "parent_code": "04"},
    {"code": "05.1", "label": "PPI Customer Approval", "parent_code": "05"},
    {"code": "06.0", "label": "Pending SSR", "parent_code": "06"},
    {"code": "06.1", "label": "SSR Hold", "parent_code": "06"},
    {"code": "06.2", "label": "Preliminary Finished", "parent_code": "06"},
]

DETAIL_BY_CODE = {d["code"]: d for d in STATUS_DETAILS}
MAIN_BY_CODE = {m["code"]: m for m in MAIN_STEPS}

# 00.0/00.1 podem ser alcançados a partir de QUALQUER etapa (Regra 1) -
# não fazem parte da progressão sequencial abaixo.
HOLD_CODES = {"00.0", "00.1"}

# Sub-etapas de "hold" que também marcam a coluna "Hold" = "On Hold" (dado
# observado na base real), mas que continuam fazendo parte do fluxo
# sequencial normal (diferente de 00.0/00.1, que saem do fluxo).
HOLD_LIKE_CODES = HOLD_CODES | {"03.0", "04.0", "06.1"}

# Ordem sequencial "normal" do fluxo, sem 00.0/00.1. Usada para: (1)
# calcular quais etapas ficam "puladas" numa transição de mais de um
# passo, e (2) resolver de onde retomar depois de um Hold/Cancelled.
SEQUENTIAL_CODES = [d["code"] for d in STATUS_DETAILS if d["code"] not in HOLD_CODES]

# Etapas que não existem no caminho SWAP (Regra 3): todas as sub-etapas
# de "02-LOS Simulation / Link Design" e "03-LOS / Survey On Field",
# incluindo a sub-etapa de interrupção "03.0-Survey Hold" - o passo 03
# inteiro não existe para SWAP (sem ida a campo). Note que o equivalente
# em frontend/src/statusFlow.js NÃO inclui "03.0": lá a lista filtra
# DETAIL_TRACK, que não tem nós de interrupção (03.0 é um marcador à
# parte, resolvido via HOLD_STOP_AT antes da checagem) - os dois
# conjuntos cobrem o mesmo caminho, cada um na representação do seu lado;
# mantenha-os em sincronia se as sub-etapas de 02/03 mudarem.
SWAP_SKIP_CODES = {"02.1", "02.2", "02.3", "02.4", "03.0", "03.1", "03.2", "03.3"}

# Progressão sequencial do caminho SWAP: igual a SEQUENTIAL_CODES, sem as
# etapas que o atalho "TSSR Execution" pula.
SEQUENTIAL_CODES_SWAP = [c for c in SEQUENTIAL_CODES if c not in SWAP_SKIP_CODES]


def _sequential_codes_for(scope):
    """Progressão sequencial a considerar para uma transição, de acordo com o SCOPE do link (Regra 3)."""
    return SEQUENTIAL_CODES_SWAP if scope == "SWAP" else SEQUENTIAL_CODES


def _auto(fields):
    """
    Campo(s) gravado(s) automaticamente com a data atual do sistema ao
    alcançar a etapa diretamente (sem pular nada) - não exige nenhuma
    pergunta ao usuário. Quando a etapa é pulada (Regra 2), o mesmo campo
    vira preenchimento retroativo opcional (ver allowed_retroactive_fields).
    """
    return {
        "type": "auto",
        "fields": [{"field": field, "label": label} for field, label in fields],
    }


def _manual(fields):
    """
    Campo(s) que exigem uma data escolhida pelo usuário (não a data atual
    do sistema) - obrigatório antes de efetivar a transição quando a etapa
    é o destino direto (ex: Regra 7 - datas de PO/campo pedidas em modal).
    """
    return {
        "type": "manual",
        "fields": [{"field": field, "label": label} for field, label in fields],
    }


def _choice(label, options):
    """
    Pergunta de múltipla escolha (ex: qual documento foi entregue) - a data
    gravada para o(s) campo(s) da opção escolhida é sempre a data atual do
    sistema, nunca escolhida pelo usuário. Cada lista de options deve
    incluir uma opção "Ambos" cujo `fields` seja a união dos demais.
    """
    return {
        "type": "choice",
        "label": label,
        "options": [{"label": opt_label, "fields": fields} for opt_label, fields in options],
    }


# Datas gravadas ao ALCANÇAR cada etapa (representam a conclusão do passo
# anterior). Sub-etapas de hold (Survey/PPI/SSR Hold) não gravam data -
# são interrupção, não avanço. Etapas sem coluna de data conhecida (ex:
# aguardando documento do cliente, aguardando aprovação para começar o
# próximo passo) não entram neste dicionário.
STAGE_DATE_REQUIREMENTS = {
    "01.2": [_auto([("po_date", "PO DATE")])],
    "02.1": [_auto([("du_creation", "DU CREATION")])],
    "02.2": [_auto([
        ("sar_pe_pta", "SAR / PE PTA"),
        ("sar_pe_ptb", "SAR / PE PTB"),
    ])],
    "02.3": [_auto([("los_simulation_r", "LOS Simulation — Realizado")])],
    "03.0": [_auto([("ld_r", "LD — Realizado")])],
    "03.1": [_manual([
        ("pr_supplier", "Data de emissão da PO"),
        ("survey_on_field_p", "Previsão de ida a campo"),
    ])],
    "03.2": [_auto([
        ("survey_on_field_r", "Survey on Field — Realizado"),
        ("los_on_field_r", "LOS on Field — Realizado"),
    ])],
    "03.3": [
        _choice("Qual documento foi entregue?", [
            ("TSSR", ["tssr_supplier_r"]),
            ("LOS", ["los_report_supplier_r"]),
            ("Ambos", ["tssr_supplier_r", "los_report_supplier_r"]),
        ]),
    ],
    "04.1": [_auto([("tssr_analysis_r", "TSSR Analysis — Realizado")])],
    "05.1": [_auto([("ppi_r", "PPI — Realizado")])],
    "06.0": [_auto([("ppi_customer_approval_r", "PPI Customer Approval — Realizado")])],
    "06.2": [
        _choice("Qual documento foi entregue?", [
            ("SSR PTA", ["ssr_pta_r"]),
            ("SSR PTB", ["ssr_ptb_r"]),
            ("Ambos", ["ssr_pta_r", "ssr_ptb_r"]),
        ]),
    ],
}


def _requirement_fields(req):
    if req["type"] in ("auto", "manual"):
        return {f["field"] for f in req["fields"]}
    return {field for opt in req["options"] for field in opt["fields"]}


def allowed_retroactive_fields(codes):
    """Conjunto de internal_name aceitos como data retroativa para uma lista de códigos de etapa."""
    allowed = set()
    for code in codes:
        for req in STAGE_DATE_REQUIREMENTS.get(code, []):
            allowed.update(_requirement_fields(req))
    return allowed


def target_requirements(code):
    """Requisitos (auto/manual/choice) da própria etapa de destino - usados para
    decidir o que preencher automaticamente e o que exigir via modal quando
    a transição chega diretamente nela (sem pular etapas)."""
    return STAGE_DATE_REQUIREMENTS.get(code, [])


def stages_to_confirm(reference_code, target_code, scope=None):
    """
    Etapas entre reference_code (exclusive) e target_code (inclusive), na
    ordem sequencial - as que exigiriam confirmação/preenchimento de data
    numa transição para a frente (Regra 2). Vazio se não for um avanço
    válido (target não é sequencial, ou não fica à frente da referência).

    `scope` (Regra 3): quando "SWAP", usa a progressão sequencial sem as
    etapas de SWAP_SKIP_CODES - elas não existem nesse caminho, então uma
    transição de 01.2 para 04.1 não as trata como puladas.
    """
    sequential = _sequential_codes_for(scope)
    if target_code not in sequential:
        return []
    if reference_code not in sequential:
        return [target_code]
    i, j = sequential.index(reference_code), sequential.index(target_code)
    if j <= i:
        return []
    return sequential[i + 1: j + 1]


def extract_code(text):
    if not text:
        return None
    match = re.match(r"^(\d{2}\.\d)", str(text).strip())
    code = match.group(1) if match else None
    return code if code in DETAIL_BY_CODE else None


def current_detail_code(record):
    return extract_code(record.get("preliminary_status_detail")) or extract_code(record.get("preliminary_status"))


def format_detail(code):
    detail = DETAIL_BY_CODE[code]
    return f"{detail['code']}-{detail['label']}"


def format_main(code):
    main = MAIN_BY_CODE[DETAIL_BY_CODE[code]["parent_code"]]
    return f"{main['code']}-{main['label']}"


def serialize_config():
    """Config exposta via GET /api/stage-flow para o frontend montar o modal de transição."""
    return {
        "main_steps": MAIN_STEPS,
        "status_details": STATUS_DETAILS,
        "hold_codes": sorted(HOLD_CODES),
        "hold_like_codes": sorted(HOLD_LIKE_CODES),
        "sequential_codes": SEQUENTIAL_CODES,
        "sequential_codes_swap": SEQUENTIAL_CODES_SWAP,
        "stage_date_requirements": STAGE_DATE_REQUIREMENTS,
    }
