"""
export_routes.py
-----------------
Endpoint de exportação. Devolve um .xlsx já formatado no padrão do
controle (ver export_excel.py).

Aceita uma lista opcional de ids para exportar só o que está filtrado na
tela. Lista vazia (ou ausente) = exporta tudo.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import export_excel
from database import TABLE_NAME, get_connection
from schema_loader import load_schema

router = APIRouter(prefix="/api")

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class ExportRequest(BaseModel):
    # None ou [] = exporta a base inteira.
    ids: Optional[list[int]] = None


@router.post("/export")
def export_links(payload: ExportRequest):
    schema = load_schema()
    names = [field["internal_name"] for field in schema]

    conn = get_connection()
    try:
        if payload.ids:
            # Parametrizado (nunca interpolado): os ids vêm do cliente.
            placeholders = ",".join("?" for _ in payload.ids)
            rows = conn.execute(
                f"SELECT * FROM {TABLE_NAME} WHERE id IN ({placeholders}) ORDER BY id ASC",
                payload.ids,
            ).fetchall()
        else:
            rows = conn.execute(f"SELECT * FROM {TABLE_NAME} ORDER BY id ASC").fetchall()
    finally:
        conn.close()

    records = [{name: row[name] for name in names} for row in rows]

    try:
        stream = export_excel.build_workbook(records, schema)
    except export_excel.ExportError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    file_name = export_excel.build_file_name()
    return StreamingResponse(
        stream,
        media_type=XLSX_MIME,
        headers={
            "Content-Disposition": f'attachment; filename="{file_name}"',
            # Sem isso o JavaScript não enxerga o cabeçalho acima e não
            # consegue usar o nome de arquivo sugerido pelo backend.
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
