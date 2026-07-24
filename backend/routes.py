"""
routes.py
---------
Endpoints da API. Todos operam sobre a tabela dinâmica 'links'
(ver database.py) cujas colunas vêm do schema (ver schema_loader.py).
"""

from datetime import date
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
    # Regra 2 (preenchimento retroativo): datas escolhidas pelo usuário para
    # etapas PULADAS (fora a etapa de destino) - opcional, campo omitido fica em branco.
    retroactive_dates: dict[str, Optional[str]] = {}
    # Regra 7 (etapa de destino "manual"): datas escolhidas pelo usuário -
    # obrigatórias quando a etapa de destino exige (ex: 03.0 -> 03.1).
    manual_dates: dict[str, str] = {}
    # Regras 9/13 (etapa de destino "choice"): campo(s) da opção escolhida
    # (ex: qual documento foi entregue) - a data gravada é sempre a de hoje.
    choice_fields: list[str] = []


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
    uma vez, as datas das etapas PULADAS (excluindo a etapa de destino)
    podem ser preenchidas retroativamente via `retroactive_dates` - campos
    fora do conjunto permitido para essa transição são rejeitados (400),
    campos omitidos ficam em branco (permitido, é uma escolha válida do
    usuário).

    A etapa de DESTINO em si nunca usa `retroactive_dates`: se o requisito
    dela for "auto", a data de hoje é gravada automaticamente; se for
    "manual" ou "choice" (Regras 7, 9, 13), os valores obrigatórios vêm de
    `manual_dates` / `choice_fields` e a ausência deles é rejeitada (400) -
    o frontend deve ter aberto o modal correspondente antes de chamar esta
    rota.

    Regra 3 (SCOPE=SWAP) - o scope do link (record["scope"]) é repassado a
    `stages_to_confirm` para que as etapas que não existem no caminho SWAP
    (ver stage_flow.SWAP_SKIP_CODES) não sejam tratadas como puladas numa
    transição de 01.2 direto para 04.1.
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

            to_confirm = stage_flow.stages_to_confirm(reference_code, target_code, scope=record.get("scope"))
            skipped_codes = to_confirm[:-1]  # tudo menos a própria etapa de destino

            allowed_fields = stage_flow.allowed_retroactive_fields(skipped_codes)
            for field, value in payload.retroactive_dates.items():
                if field not in allowed_fields:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Campo '{field}' não é uma data retroativa válida para esta transição",
                    )
                if value:
                    updates[field] = value

            # Requisito da própria etapa de destino - só se aplica quando ela
            # é de fato alcançada por este avanço (to_confirm não vazio; vazio
            # = retrocesso/lateral, que não grava data nenhuma).
            if to_confirm:
                for req in stage_flow.target_requirements(target_code):
                    if req["type"] == "auto":
                        today = date.today().isoformat()
                        for f in req["fields"]:
                            updates[f["field"]] = today
                    elif req["type"] == "manual":
                        for f in req["fields"]:
                            value = payload.manual_dates.get(f["field"])
                            if not value:
                                raise HTTPException(
                                    status_code=400,
                                    detail=f"Informe '{f['label']}' antes de mudar para a etapa "
                                    f"'{stage_flow.format_detail(target_code)}'",
                                )
                            updates[f["field"]] = value
                    elif req["type"] == "choice":
                        valid_fields = {field for opt in req["options"] for field in opt["fields"]}
                        chosen = [f for f in payload.choice_fields if f in valid_fields]
                        if not chosen:
                            raise HTTPException(
                                status_code=400,
                                detail=f"Responda '{req['label']}' antes de mudar para a etapa "
                                f"'{stage_flow.format_detail(target_code)}'",
                            )
                        today = date.today().isoformat()
                        for field in chosen:
                            updates[field] = today

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
