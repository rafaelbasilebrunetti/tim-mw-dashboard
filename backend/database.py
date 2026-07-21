"""
database.py
------------
Cria e conecta ao banco SQLite usando o schema dinâmico gerado por
schema_loader.py (baseado no CSV em config/templates/).

Nenhuma coluna é fixa em código: se você editar o CSV template e rodar
`python schema_loader.py` de novo, rode este arquivo (ou reinicie o
app) para recriar a tabela com o novo padrão.
"""

import os
import sqlite3

from schema_loader import load_schema

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")
DB_PATH = os.path.join(DATA_DIR, "dashboard.db")

# Mapeia os tipos abstratos do schema_loader para tipos SQLite
TYPE_MAP = {
    "string": "TEXT",
    "integer": "INTEGER",
    "float": "REAL",
    "date": "TEXT",  # guardado como texto ISO (YYYY-MM-DD) por simplicidade
}

TABLE_NAME = "links"


def get_connection():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def create_table(force_recreate: bool = False):
    """
    Cria a tabela 'links' com uma coluna para cada campo do schema,
    mais um id autoincremento e um timestamp de última atualização.
    """
    schema = load_schema()

    conn = get_connection()
    cur = conn.cursor()

    if force_recreate:
        cur.execute(f"DROP TABLE IF EXISTS {TABLE_NAME}")

    columns_sql = []
    for field in schema:
        col_type = TYPE_MAP.get(field["type"], "TEXT")
        # nome interno já é seguro (snake_case, sem espaços/acentos)
        columns_sql.append(f'"{field["internal_name"]}" {col_type}')

    create_stmt = f"""
    CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        {", ".join(columns_sql)},
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """
    cur.execute(create_stmt)
    conn.commit()
    conn.close()

    print(f"Tabela '{TABLE_NAME}' pronta em {DB_PATH} com {len(schema)} colunas de dados.")


if __name__ == "__main__":
    create_table(force_recreate=False)
