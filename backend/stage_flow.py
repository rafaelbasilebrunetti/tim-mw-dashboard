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


def _single(field, label):
    return {"type": "single", "field": field, "label": label}


def _choice(label, options):
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
    "01.2": [_single("po_date", "PO DATE")],
    "02.1": [_single("du_creation", "DU CREATION")],
    "02.3": [_single("los_simulation_r", "LOS Simulation — Realizado")],
    "03.1": [_single("ld_r", "LD — Realizado")],
    "03.2": [
        _single("survey_on_field_r", "Survey on Field — Realizado"),
        _single("los_on_field_r", "LOS on Field — Realizado"),
    ],
    "03.3": [
        _choice("Documento entregue pelo fornecedor", [
            ("LOS Report Supplier", ["los_report_supplier_r"]),
            ("TSSR Supplier", ["tssr_supplier_r"]),
        ]),
    ],
    "04.1": [
        _choice("Análise concluída", [
            ("LOS Analysis", ["los_analysis_r"]),
            ("TSSR Analysis", ["tssr_analysis_r"]),
        ]),
    ],
    "05.1": [_single("ppi_r", "PPI — Realizado")],
    "06.0": [_single("ppi_customer_approval_r", "PPI Customer Approval — Realizado")],
    "06.2": [
        _choice("Documento SSR recebido", [
            ("SSR PTA", ["ssr_pta_r"]),
            ("SSR PTB", ["ssr_ptb_r"]),
        ]),
    ],
}


def allowed_retroactive_fields(codes):
    """Conjunto de internal_name aceitos como data retroativa para uma lista de códigos de etapa."""
    allowed = set()
    for code in codes:
        for req in STAGE_DATE_REQUIREMENTS.get(code, []):
            if req["type"] == "single":
                allowed.add(req["field"])
            else:
                for opt in req["options"]:
                    allowed.update(opt["fields"])
    return allowed


def stages_to_confirm(reference_code, target_code):
    """
    Etapas entre reference_code (exclusive) e target_code (inclusive), na
    ordem sequencial - as que exigiriam confirmação/preenchimento de data
    numa transição para a frente (Regra 2). Vazio se não for um avanço
    válido (target não é sequencial, ou não fica à frente da referência).
    """
    if target_code not in SEQUENTIAL_CODES:
        return []
    if reference_code not in SEQUENTIAL_CODES:
        return [target_code]
    i, j = SEQUENTIAL_CODES.index(reference_code), SEQUENTIAL_CODES.index(target_code)
    if j <= i:
        return []
    return SEQUENTIAL_CODES[i + 1: j + 1]


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
        "stage_date_requirements": STAGE_DATE_REQUIREMENTS,
    }
