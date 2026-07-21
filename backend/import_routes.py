"""
import_routes.py
-----------------
Endpoint de import de planilha (.xlsx) via upload web. Reaproveita a
mesma lógica de leitura/casamento de colunas/gravação do script CLI
(import_data.py) - aqui só entra o transporte HTTP (multipart) e a
validação de que o arquivo enviado tem cara de planilha do template.
"""

import io

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from openpyxl import load_workbook

from database import get_connection
from import_data import build_column_mapping, process_rows, read_rows_from_workbook
from schema_loader import load_schema

router = APIRouter(prefix="/api")

# Colunas mínimas que precisam ser reconhecidas para considerar que o
# arquivo enviado é, de fato, um controle de sites no formato esperado.
REQUIRED_INTERNAL_NAMES = {"oc", "tim_key", "site_a", "site_b"}


@router.post("/import")
def import_links(file: UploadFile = File(...), upsert: bool = Form(False)):
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .xlsx")

    raw = file.file.read()
    try:
        wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Não foi possível ler o arquivo. Confirme se é um .xlsx válido.")

    try:
        file_headers, data_rows = read_rows_from_workbook(wb)
    finally:
        wb.close()

    if not file_headers or not data_rows:
        raise HTTPException(status_code=400, detail="Planilha vazia ou sem linhas de dados.")

    schema = load_schema()
    mapping, _ = build_column_mapping(file_headers, schema)
    matched_names = {f["internal_name"] for f in mapping if f}
    if not REQUIRED_INTERNAL_NAMES & matched_names:
        raise HTTPException(
            status_code=400,
            detail=(
                "Arquivo não reconhecido: nenhuma das colunas essenciais "
                "(OC, TIM Key, Site A, Site B) foi encontrada. Verifique se é o formato esperado."
            ),
        )

    conn = get_connection()
    try:
        report = process_rows(file_headers, data_rows, schema, conn, dry_run=False, upsert=upsert)
    finally:
        conn.close()

    report["failed"] = report["failed"][:20]
    return report
