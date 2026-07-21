"""
routes.py
---------
Endpoints da API. Todos operam sobre a tabela dinâmica 'links'
(ver database.py) cujas colunas vêm do schema (ver schema_loader.py).
"""

from fastapi import APIRouter, HTTPException

from database import TABLE_NAME, get_connection
from models import LinkCreate, LinkOut
from schema_loader import load_schema

router = APIRouter(prefix="/api")


@router.get("/schema")
def get_schema():
    """
    Devolve a lista de campos (nome interno, rótulo, tipo, agrupamento
    Planejado/Realizado) para o frontend montar a tela dinamicamente,
    sem precisar saber os nomes das colunas de antemão.
    """
    return load_schema()


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

    columns = ", ".join(f'"{k}"' for k in data.keys())
    placeholders = ", ".join("?" for _ in data)
    values = list(data.values())

    conn = get_connection()
    cur = conn.execute(
        f"INSERT INTO {TABLE_NAME} ({columns}) VALUES ({placeholders})", values
    )
    conn.commit()
    new_id = cur.lastrowid
    row = conn.execute(f"SELECT * FROM {TABLE_NAME} WHERE id = ?", (new_id,)).fetchone()
    conn.close()
    return dict(row)


@router.put("/links/{link_id}", response_model=LinkOut)
def update_link(link_id: int, link: LinkCreate):
    data = link.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="Nenhum campo enviado")

    conn = get_connection()
    existing = conn.execute(f"SELECT id FROM {TABLE_NAME} WHERE id = ?", (link_id,)).fetchone()
    if existing is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Link não encontrado")

    set_clause = ", ".join(f'"{k}" = ?' for k in data.keys())
    values = list(data.values()) + [link_id]
    conn.execute(
        f"UPDATE {TABLE_NAME} SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        values,
    )
    conn.commit()
    row = conn.execute(f"SELECT * FROM {TABLE_NAME} WHERE id = ?", (link_id,)).fetchone()
    conn.close()
    return dict(row)


@router.delete("/links/{link_id}", status_code=204)
def delete_link(link_id: int):
    conn = get_connection()
    existing = conn.execute(f"SELECT id FROM {TABLE_NAME} WHERE id = ?", (link_id,)).fetchone()
    if existing is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Link não encontrado")
    conn.execute(f"DELETE FROM {TABLE_NAME} WHERE id = ?", (link_id,))
    conn.commit()
    conn.close()
    return None
