"""
models.py
---------
Constrói modelos Pydantic dinamicamente a partir do schema gerado por
schema_loader.py. Como o schema pode mudar (usuário edita o CSV), os
modelos são gerados em tempo de execução em vez de escritos à mão.
"""

from datetime import date
from typing import Optional

from pydantic import create_model

from schema_loader import load_schema

# Tipo Python correspondente a cada tipo abstrato do schema
PY_TYPE_MAP = {
    "string": str,
    "integer": int,
    "float": float,
    "date": str,  # aceitamos string "YYYY-MM-DD" para simplicidade no front
}


def _build_link_models():
    schema = load_schema()

    # Todos os campos são opcionais (linha pode estar parcialmente
    # preenchida durante o processo - ex: ainda não tem "PPI (R)")
    fields_optional = {
        field["internal_name"]: (Optional[PY_TYPE_MAP.get(field["type"], str)], None)
        for field in schema
    }

    # Modelo para criar (POST) e atualizar (PUT) - mesmos campos, todos opcionais
    LinkCreate = create_model("LinkCreate", **fields_optional)

    # Modelo de resposta (GET) - inclui id e updated_at
    fields_out = dict(fields_optional)
    fields_out["id"] = (int, ...)
    fields_out["updated_at"] = (Optional[str], None)
    LinkOut = create_model("LinkOut", **fields_out)

    return LinkCreate, LinkOut


LinkCreate, LinkOut = _build_link_models()
