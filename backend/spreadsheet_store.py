"""
spreadsheet_store.py
---------------------
Mantém a planilha principal (data/seu_controle.xlsx) sempre sincronizada
com o banco: ela é a fonte "viva" dos dados - toda alteração feita pela
interface (criar, editar, excluir site) é gravada de volta nela, e ela é
relida (merge por TIM Key) toda vez que o backend sobe.

Segurança contra corrupção:
    - A planilha inteira é regravada do zero a partir do estado atual do
      banco, num arquivo temporário; só depois de essa escrita terminar
      sem erro é que o arquivo original é substituído via os.replace()
      (troca atômica no mesmo disco - nunca existe um estado "meio
      escrito" no arquivo final).
    - Antes de sobrescrever, a versão anterior é copiada com timestamp
      para data/backups/ (mantém as últimas BACKUP_RETENTION cópias).
    - Se qualquer passo falhar (arquivo aberto no Excel, disco cheio,
      permissão negada etc.), SpreadsheetWriteError é levantada - quem
      chamou (routes.py) desfaz a alteração no banco e devolve um erro
      claro para a interface, para nunca deixar o usuário achar que
      salvou quando não salvou.
"""

import datetime as dt
import os
import shutil
import threading

from openpyxl import Workbook

from database import TABLE_NAME

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
MAIN_XLSX = os.path.join(DATA_DIR, "seu_controle.xlsx")
BACKUPS_DIR = os.path.join(DATA_DIR, "backups")
BACKUP_RETENTION = 30

_lock = threading.Lock()


class SpreadsheetWriteError(Exception):
    """Levantada quando a planilha principal não pôde ser gravada com segurança."""


def _backup_current_file():
    if not os.path.exists(MAIN_XLSX):
        return
    os.makedirs(BACKUPS_DIR, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(BACKUPS_DIR, f"seu_controle_{stamp}.xlsx")
    shutil.copy2(MAIN_XLSX, backup_path)
    _prune_old_backups()


def _prune_old_backups():
    backups = sorted(
        f for f in os.listdir(BACKUPS_DIR) if f.startswith("seu_controle_") and f.endswith(".xlsx")
    )
    excess = len(backups) - BACKUP_RETENTION
    for name in backups[:excess]:
        try:
            os.remove(os.path.join(BACKUPS_DIR, name))
        except OSError:
            pass


def _cell_value(record, field):
    value = record.get(field["internal_name"])
    if value in (None, ""):
        return None
    if field["type"] == "date" and isinstance(value, str):
        try:
            return dt.datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            return value
    return value


def write_records(records, schema):
    """
    Regrava a planilha principal inteira a partir do estado atual do banco.

    records: lista de dicts (um por site), na ordem em que devem virar
             linhas da planilha.
    schema:  schema de campos (ver schema_loader.load_schema) - dita o
             cabeçalho e a ordem das colunas, igual ao padrão já usado
             nos registros existentes.
    """
    ordered_fields = sorted(schema, key=lambda f: f["index"])
    tmp_path = MAIN_XLSX + ".tmp"

    with _lock:
        try:
            os.makedirs(DATA_DIR, exist_ok=True)

            wb = Workbook()
            ws = wb.active
            ws.title = "BASE"
            ws.append([field["csv_header"] for field in ordered_fields])
            for record in records:
                ws.append([_cell_value(record, field) for field in ordered_fields])
            wb.save(tmp_path)
            wb.close()

            _backup_current_file()
            os.replace(tmp_path, MAIN_XLSX)
        except Exception as exc:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            raise SpreadsheetWriteError(
                f"não foi possível gravar {os.path.basename(MAIN_XLSX)} ({exc})"
            ) from exc


def sync_from_spreadsheet(conn):
    """
    Chamada na subida do backend: relê a planilha principal e mescla no
    banco por TIM Key. Garante que, se o banco for perdido/recriado (ou
    nunca existiu), o app reconstrói os dados a partir dela; e que sites
    novos adicionados à mão diretamente na planilha (fora do app) entram
    no banco no próximo boot.

    Importante - a mescla NUNCA sobrescreve um valor que já existe no
    banco, só preenche campos que estão vazios (mesma regra já usada em
    routes.py para o enriquecimento por planilha de referência). Isso
    evita que a sincronização apague, com um valor em branco, um campo
    que só foi preenchido pelo próprio app depois da última vez que a
    planilha foi gravada (ex: campos de Site A/B preenchidos pelo
    enriquecimento automático, que nunca vieram do arquivo importado).

    Linhas sem TIM Key (ex: legenda/observação solta na planilha, que não
    é um site de verdade) são ignoradas - não dá pra mesclar com segurança
    o que não tem chave, e reinseri-las a cada boot duplicaria sem parar.

    Nunca derruba a subida do backend - se a planilha estiver ausente,
    corrompida ou aberta em modo exclusivo em outro programa, só registra
    um aviso e segue.
    """
    if not os.path.exists(MAIN_XLSX):
        return

    from import_data import build_column_mapping, excel_value_to_str, read_rows
    from schema_loader import load_schema

    try:
        schema = load_schema()
        file_headers, data_rows = read_rows(MAIN_XLSX)
        mapping, _ = build_column_mapping(file_headers, schema)

        tim_key_idx = next(
            (i for i, field in enumerate(mapping) if field and field["internal_name"] == "tim_key"),
            None,
        )
        if tim_key_idx is None:
            return

        existing_by_key = {
            row["tim_key"]: row["id"]
            for row in conn.execute(f'SELECT id, tim_key FROM {TABLE_NAME}').fetchall()
            if row["tim_key"]
        }

        for row in data_rows:
            record = {}
            for value, field in zip(row, mapping):
                if field is None:
                    continue
                record[field["internal_name"]] = excel_value_to_str(value, field["type"])

            # TIM Keys como "2025.000735" costumam vir do Excel como
            # número de ponto flutuante, não como texto (a célula não
            # está formatada como texto) - excel_value_to_str não força
            # a conversão pra string nesse caso. O banco guarda como TEXT
            # (SQLite converte na hora do INSERT), então comparar o float
            # cru contra as strings do banco nunca bate - normaliza os
            # dois lados pra string antes de comparar.
            tim_key = record.get("tim_key")
            if tim_key is not None:
                tim_key = str(tim_key).strip()
                record["tim_key"] = tim_key
            if tim_key in (None, ""):
                continue
            if not any(v not in (None, "") for v in record.values()):
                continue

            existing_id = existing_by_key.get(tim_key)
            if existing_id is None:
                columns = ", ".join(f'"{k}"' for k in record.keys())
                placeholders = ", ".join("?" for _ in record)
                conn.execute(
                    f'INSERT INTO {TABLE_NAME} ({columns}) VALUES ({placeholders})',
                    list(record.values()),
                )
            else:
                current = dict(
                    conn.execute(f'SELECT * FROM {TABLE_NAME} WHERE id = ?', (existing_id,)).fetchone()
                )
                fill_ins = {
                    k: v for k, v in record.items()
                    if v not in (None, "") and current.get(k) in (None, "")
                }
                if fill_ins:
                    set_clause = ", ".join(f'"{k}" = ?' for k in fill_ins.keys())
                    conn.execute(
                        f'UPDATE {TABLE_NAME} SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        list(fill_ins.values()) + [existing_id],
                    )

        conn.commit()
    except Exception as exc:
        print(f"[spreadsheet_store] Aviso: não foi possível sincronizar a partir de "
              f"{MAIN_XLSX}: {exc}")
