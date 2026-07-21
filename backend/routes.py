"""
routes.py
---------
Endpoints da API. Todos operam sobre a tabela dinâmica 'links'
(ver database.py) cujas colunas vêm do schema (ver schema_loader.py).
"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import stage_flow
from database import TABLE_NAME, fetch_all_records, get_connection
from models import LinkCreate, LinkOut
from schema_loader import load_schema
from site_reference import lookup_site
from spreadsheet_store import SpreadsheetWriteError, write_records

router = APIRouter(prefix="/api")


class TransitionRequest(BaseModel):
    target_code: str
    retroactive_dates: dict[str, Optional[str]] = {}


def _persist_to_spreadsheet(conn, schema):
    """
    Regrava a planilha principal com o estado atual (ainda não commitado)
    do banco. Se a gravação falhar, desfaz a alteração no banco e levanta
    um erro claro para a interface - a alteração não fica "meio salva"
    (só no banco, sem refletir na planilha).
    """
    try:
        write_records(fetch_all_records(conn, schema), schema)
    except SpreadsheetWriteError as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"A alteração NÃO foi salva: {exc}. Nada foi persistido - tente novamente.",
        )


@router.get("/schema")
def get_schema():
    """
    Devolve a lista de campos (nome interno, rótulo, tipo, agrupamento
    Planejado/Realizado) para o frontend montar a tela dinamicamente,
    sem precisar saber os nomes das colunas de antemão.
    """
    return load_schema()


@router.get("/stage-flow")
def get_stage_flow():
    """
    Devolve a ordem das etapas do "Preliminary Status Detail" e as
    colunas de data que cada uma grava, para o frontend montar o modal
    de transição de etapa sem precisar hard-codar esse conhecimento.
    """
    return stage_flow.serialize_config()


@router.post("/links/{link_id}/transition", response_model=LinkOut)
def transition_link(link_id: int, payload: TransitionRequest):
    """
    Move um site para uma nova etapa (Preliminary Status / Detail),
    aplicando duas regras:

    Regra 1 - Hold/Cancelled (00.0/00.1) podem ser alcançados a partir de
    qualquer etapa, sem exigir nenhuma data. A etapa em que o site estava
    é guardada em `previous_status_detail` para sugerir a retomada depois.

    Regra 2 - Ao sair do Hold/Cancelled ou avançar mais de um passo de
    uma vez, as datas das etapas puladas (e da etapa final) podem ser
    preenchidas retroativamente via `retroactive_dates` - campos fora do
    conjunto permitido para essa transição são rejeitados (400), campos
    omitidos ficam em branco (permitido, é uma escolha válida do usuário).
    """
    if payload.target_code not in stage_flow.DETAIL_BY_CODE:
        raise HTTPException(status_code=400, detail=f"Etapa '{payload.target_code}' desconhecida")

    schema = load_schema()
    conn = get_connection()
    try:
        row = conn.execute(f"SELECT * FROM {TABLE_NAME} WHERE id = ?", (link_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Link não encontrado")
        record = dict(row)

        target_code = payload.target_code
        current_code = stage_flow.current_detail_code(record)
        updates = {}

        if target_code in stage_flow.HOLD_CODES:
            # Regra 1: nenhuma data exigida. Só guarda a etapa anterior se
            # o site ainda não estava em Hold/Cancelled - se já estava
            # (ex: trocando de Cancelled para Hold direto), preserva o
            # rastro da etapa de antes do primeiro Hold/Cancelled.
            if current_code and current_code not in stage_flow.HOLD_CODES:
                updates["previous_status_detail"] = record.get("preliminary_status_detail") or current_code
        else:
            # Saída do Hold/Cancelled ou avanço normal: se o site estava
            # em Hold/Cancelled, a referência para calcular o que foi
            # "pulado" é a etapa guardada antes de entrar em Hold - não a
            # etapa 00.0/00.1 em si, que não é sequencial.
            if current_code in stage_flow.HOLD_CODES:
                reference_code = stage_flow.extract_code(record.get("previous_status_detail"))
                updates["previous_status_detail"] = None
            else:
                reference_code = current_code

            to_confirm = stage_flow.stages_to_confirm(reference_code, target_code)
            allowed_fields = stage_flow.allowed_retroactive_fields(to_confirm)
            for field, value in payload.retroactive_dates.items():
                if field not in allowed_fields:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Campo '{field}' não é uma data válida para preencher nesta transição",
                    )
                if value:
                    updates[field] = value

        updates["preliminary_status_detail"] = stage_flow.format_detail(target_code)
        updates["preliminary_status"] = stage_flow.format_main(target_code)
        updates["hold"] = "On Hold" if target_code in stage_flow.HOLD_LIKE_CODES else None

        set_clause = ", ".join(f'"{k}" = ?' for k in updates.keys())
        conn.execute(
            f'UPDATE {TABLE_NAME} SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            list(updates.values()) + [link_id],
        )
        _persist_to_spreadsheet(conn, schema)
        conn.commit()
        row = conn.execute(f"SELECT * FROM {TABLE_NAME} WHERE id = ?", (link_id,)).fetchone()
        return dict(row)
    finally:
        conn.close()


@router.get("/links", response_model=list[LinkOut])
def list_links():
    conn = get_connection()
    rows = conn.execute(f"SELECT * FROM {TABLE_NAME} ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]


@router.get("/links/{link_id}", response_model=LinkOut)
def get_link(link_id: int):
    conn = get_connection()
    row = conn.execute(f"SELECT * FROM {TABLE_NAME} WHERE id = ?", (link_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Link não encontrado")
    return dict(row)


@router.post("/links", response_model=LinkOut, status_code=201)
def create_link(link: LinkCreate):
    data = link.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="Nenhum campo enviado")

    schema = load_schema()
    columns = ", ".join(f'"{k}"' for k in data.keys())
    placeholders = ", ".join("?" for _ in data)
    values = list(data.values())

    conn = get_connection()
    try:
        cur = conn.execute(
            f"INSERT INTO {TABLE_NAME} ({columns}) VALUES ({placeholders})", values
        )
        new_id = cur.lastrowid
        _persist_to_spreadsheet(conn, schema)
        conn.commit()
        row = conn.execute(f"SELECT * FROM {TABLE_NAME} WHERE id = ?", (new_id,)).fetchone()
        return dict(row)
    finally:
        conn.close()


@router.put("/links/{link_id}", response_model=LinkOut)
def update_link(link_id: int, link: LinkCreate):
    data = link.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="Nenhum campo enviado")

    schema = load_schema()
    conn = get_connection()
    try:
        existing = conn.execute(f"SELECT id FROM {TABLE_NAME} WHERE id = ?", (link_id,)).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Link não encontrado")

        set_clause = ", ".join(f'"{k}" = ?' for k in data.keys())
        values = list(data.values()) + [link_id]
        conn.execute(
            f"UPDATE {TABLE_NAME} SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            values,
        )
        _persist_to_spreadsheet(conn, schema)
        conn.commit()
        row = conn.execute(f"SELECT * FROM {TABLE_NAME} WHERE id = ?", (link_id,)).fetchone()
        return dict(row)
    finally:
        conn.close()


@router.post("/links/{link_id}/enrich-reference", response_model=LinkOut)
def enrich_link_site_reference(link_id: int):
    """
    Preenche automaticamente os campos de Site A / Site B que estiverem
    vazios (end_id, infra_type, município, detentora, lat, long) usando
    a planilha de referência externa (ver site_reference.py). Só grava
    em campos vazios - nunca sobrescreve um valor já existente no site.
    Não falha se a planilha não existir ou o site não for encontrado
    nela (ver lookup_site) - nesse caso simplesmente não altera nada.
    """
    schema = load_schema()
    conn = get_connection()
    try:
        row = conn.execute(f"SELECT * FROM {TABLE_NAME} WHERE id = ?", (link_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Link não encontrado")

        record = dict(row)
        updates = {}
        for suffix in ("a", "b"):
            reference = lookup_site(record.get(f"site_{suffix}"))
            if not reference.get("found"):
                continue
            field_values = {
                f"end_id_{suffix}": reference.get("end_id"),
                f"infra_type_{suffix}": reference.get("infra_type"),
                f"municipio_{suffix}": reference.get("municipio"),
                f"detentora_{suffix}": reference.get("detentora"),
                f"lat_{suffix}": reference.get("lat"),
                f"long_{suffix}": reference.get("long"),
            }
            for field, value in field_values.items():
                if value is not None and record.get(field) in (None, ""):
                    updates[field] = value

        if updates:
            set_clause = ", ".join(f'"{k}" = ?' for k in updates.keys())
            conn.execute(
                f'UPDATE {TABLE_NAME} SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                list(updates.values()) + [link_id],
            )
            _persist_to_spreadsheet(conn, schema)
            conn.commit()
            row = conn.execute(f"SELECT * FROM {TABLE_NAME} WHERE id = ?", (link_id,)).fetchone()

        return dict(row)
    finally:
        conn.close()


@router.delete("/links/{link_id}", status_code=204)
def delete_link(link_id: int):
    schema = load_schema()
    conn = get_connection()
    try:
        existing = conn.execute(f"SELECT id FROM {TABLE_NAME} WHERE id = ?", (link_id,)).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Link não encontrado")
        conn.execute(f"DELETE FROM {TABLE_NAME} WHERE id = ?", (link_id,))
        _persist_to_spreadsheet(conn, schema)
        conn.commit()
        return None
    finally:
        conn.close()
