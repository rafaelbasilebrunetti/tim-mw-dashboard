"""
schema_loader.py
-----------------
Lê o arquivo template em config/templates/ e gera o "padrão" (schema) do
dashboard automaticamente a partir do cabeçalho (primeira linha) do CSV.

Por que isso existe:
    O usuário quer poder editar o CSV template (renomear coluna, adicionar
    coluna nova) sem precisar mexer em código Python. Este módulo é o único
    lugar que "conhece" a estrutura do CSV - o resto do backend (models.py,
    routes.py) importa daqui.

Como usar:
    from schema_loader import load_schema
    schema = load_schema()
    for field in schema:
        print(field["internal_name"], field["label"], field["type"])
"""

import csv
import json
import os
import re
import unicodedata

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE_DIR = os.path.join(BASE_DIR, "config", "templates")
TEMPLATE_CSV = os.path.join(TEMPLATE_DIR, "TIM_MW_SP_Preliminary_Report_-_Template.csv")
MAPPING_JSON = os.path.join(TEMPLATE_DIR, "column_mapping.json")


# ---------------------------------------------------------------------------
# Renomeações manuais obrigatórias
# ---------------------------------------------------------------------------
# O CSV original tem nomes de coluna duplicados (o Excel/TIM usa a mesma
# etiqueta "SITE TYPE A" para dois conceitos diferentes). Como o nome sozinho
# não basta para diferenciar, o mapeamento é feito por POSIÇÃO (índice da
# coluna, começando em 0) e não só pelo texto do cabeçalho.
#
# Se você adicionar uma coluna nova ao CSV, ela entra automaticamente com um
# nome gerado (slug do cabeçalho). Só precisa editar aqui se quiser um nome
# amigável específico ou se o Excel duplicar outro rótulo no futuro.
MANUAL_OVERRIDES = {
    5:  {"internal_name": "infra_type_a",   "label": "Infra Type A (Site A)"},
    8:  {"internal_name": "infra_type_b",   "label": "Infra Type B (Site B)"},
    28: {"internal_name": "site_status_a",  "label": "Site Status A (Existente/Novo)"},
    29: {"internal_name": "site_status_b",  "label": "Site Status B (Existente/Novo)"},
}

# Colunas que sabidamente guardam data (independente do sufixo (P)/(R))
DATE_HINTS = ("PO DATE", "DU CREATION")

# Colunas de coordenada geográfica
COORD_COLUMNS = {"LAT A", "LONG A", "LAT B", "LONG B"}


def _slugify(header: str) -> str:
    """'LOS Simulation (P)' -> 'los_simulation_p'"""
    text = unicodedata.normalize("NFKD", header).encode("ascii", "ignore").decode()
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def _infer_type(header: str) -> str:
    h = header.strip()
    if h in COORD_COLUMNS:
        return "float"
    if h == "Ano":
        return "integer"
    if h.endswith("(P)") or h.endswith("(R)") or h.endswith("(R) ") or h.endswith("(P) "):
        return "date"
    if any(hint in h for hint in DATE_HINTS):
        return "date"
    return "string"


def _milestone_group(header: str) -> str | None:
    """
    Agrupa colunas (P) / (R) do mesmo marco, ex:
    'LOS Simulation (P)' e 'LOS Simulation (R)' -> grupo 'LOS Simulation'
    Isso facilita o frontend desenhar Planejado x Realizado lado a lado.
    """
    match = re.match(r"^(.*?)\s*\((P|R)\)\s*$", header.strip())
    if match:
        # normaliza espaços internos (o CSV original tem inconsistências,
        # ex: "Survey  on Field (P)" com espaço duplo vs "Survey on Field (R)")
        return re.sub(r"\s+", " ", match.group(1)).strip()
    return None


def build_mapping():
    with open(TEMPLATE_CSV, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f, delimiter=";")
        headers = next(reader)

    seen_names = {}
    fields = []

    for idx, raw_header in enumerate(headers):
        header = raw_header.strip()

        if idx in MANUAL_OVERRIDES:
            internal_name = MANUAL_OVERRIDES[idx]["internal_name"]
            label = MANUAL_OVERRIDES[idx]["label"]
        else:
            internal_name = _slugify(header)
            # evita colisão automática se um header novo repetir nome
            if internal_name in seen_names:
                seen_names[internal_name] += 1
                internal_name = f"{internal_name}_{seen_names[internal_name]}"
            else:
                seen_names[internal_name] = 0
            label = header

        fields.append({
            "index": idx,
            "csv_header": raw_header,
            "internal_name": internal_name,
            "label": label,
            "type": _infer_type(header),
            "milestone_group": _milestone_group(header),
            "role": "planned" if header.rstrip().endswith("(P)") else
                    "realized" if header.rstrip().endswith("(R)") else None,
        })

    return fields


def load_schema(force_rebuild: bool = False):
    """
    Carrega o schema. Se column_mapping.json não existir (ou force_rebuild=True),
    ele é gerado a partir do CSV template e salvo em disco.
    """
    if force_rebuild or not os.path.exists(MAPPING_JSON):
        fields = build_mapping()
        with open(MAPPING_JSON, "w", encoding="utf-8") as f:
            json.dump(fields, f, ensure_ascii=False, indent=2)
        return fields

    with open(MAPPING_JSON, encoding="utf-8") as f:
        return json.load(f)


if __name__ == "__main__":
    schema = load_schema(force_rebuild=True)
    print(f"{len(schema)} colunas mapeadas a partir de {TEMPLATE_CSV}")
    print(f"Mapeamento salvo em {MAPPING_JSON}\n")
    for f in schema:
        tag = f" [{f['milestone_group']} / {f['role']}]" if f["milestone_group"] else ""
        print(f"  [{f['index']:>2}] {f['internal_name']:<28} ({f['type']:<7}) <- \"{f['csv_header']}\"{tag}")
