"""
fix_decimal_commas.py
----------------------
Corrige valores numéricos (LAT/LONG) que foram gravados como texto com
vírgula decimal (formato brasileiro, ex: "-23,9308") em vez de ponto
(formato que o banco/API esperam, ex: -23.9308).

Isso acontece quando o Excel de origem tem essas células formatadas
como texto em vez de número. Este script não precisa que você
reimporte nada - ele corrige direto no banco de dados existente.

USO:
    python fix_decimal_commas.py            # aplica a correção
    python fix_decimal_commas.py --dry-run  # só mostra o que seria corrigido
"""

import argparse

from database import TABLE_NAME, get_connection
from schema_loader import load_schema


def fix_decimal_commas(dry_run=False):
    schema = load_schema()
    float_fields = [f["internal_name"] for f in schema if f["type"] == "float"]

    conn = get_connection()
    fixed_count = 0
    unfixable = []

    for field in float_fields:
        rows = conn.execute(
            f'SELECT id, "{field}" as val FROM {TABLE_NAME} WHERE "{field}" IS NOT NULL'
        ).fetchall()

        for row in rows:
            value = row["val"]
            if not isinstance(value, str):
                continue  # já é número, nada a fazer

            candidate = value.strip().replace(",", ".")
            try:
                as_float = float(candidate)
            except ValueError:
                unfixable.append((field, row["id"], value))
                continue

            print(f'  [{field}] id={row["id"]}: "{value}" -> {as_float}')
            fixed_count += 1
            if not dry_run:
                conn.execute(
                    f'UPDATE {TABLE_NAME} SET "{field}" = ? WHERE id = ?',
                    (as_float, row["id"]),
                )

    if not dry_run:
        conn.commit()
    conn.close()

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Concluído: {fixed_count} valor(es) corrigido(s).")
    if unfixable:
        print(f"\n⚠ {len(unfixable)} valor(es) não puderam ser convertidos para número "
              f"(revise manualmente):")
        for field, row_id, value in unfixable[:20]:
            print(f'   [{field}] id={row_id}: "{value}"')


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Corrige coordenadas com vírgula decimal no banco.")
    parser.add_argument("--dry-run", action="store_true", help="Só mostra o que seria corrigido")
    args = parser.parse_args()
    fix_decimal_commas(dry_run=args.dry_run)
