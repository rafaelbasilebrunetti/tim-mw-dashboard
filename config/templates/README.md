# config/templates/

Esta pasta é a **fonte única da verdade** do padrão (schema) do dashboard.

## Arquivos

- **`TIM_MW_SP_Preliminary_Report_-_Template.csv`**
  O template oficial. A **primeira linha define os títulos das colunas**.
  Para adicionar/remover/renomear um campo do dashboard inteiro, edite
  este arquivo — não mexa em código.

- **`column_mapping.json`**
  Gerado automaticamente por `backend/schema_loader.py` a partir do CSV
  acima. Não edite este arquivo à mão (ele é sobrescrito). Ele traduz cada
  cabeçalho do CSV em um "nome interno" seguro para usar no banco de
  dados e na API (ex: `"LOS Simulation (P)"` -> `los_simulation_p`).

## Como editar o padrão

1. Abra o CSV neste diretório (pode editar no Excel).
2. Adicione, renomeie ou remova uma coluna na **primeira linha**.
3. Salve, mantendo o separador `;` (ponto e vírgula).
4. Rode:
   ```
   cd backend
   python schema_loader.py
   ```
   Isso regenera `column_mapping.json` com o novo padrão.
5. Reinicie o backend (`python app.py`). A API e o banco de dados passam
   a refletir o novo campo automaticamente.

## Por que duas colunas "SITE TYPE A" e "SITE TYPE B" existem no CSV?

O template original tem o mesmo rótulo usado para dois conceitos
diferentes. Isso é resolvido manualmente em `MANUAL_OVERRIDES` dentro de
`schema_loader.py`, por **posição da coluna** (não pelo nome, já que o
nome é ambíguo):

| Posição | Rótulo no CSV      | Nome interno    | Significado real                  |
|---------|---------------------|------------------|------------------------------------|
| 5       | `SITE TYPE A`        | `infra_type_a`   | Tipo de infraestrutura do Site A   |
| 8       | `SITE TYPE B`         | `infra_type_b`   | Tipo de infraestrutura do Site B   |
| 28      | `SITE TYPE A ` (dup.) | `site_status_a`  | Site A é Existente ou Novo         |
| 29      | `SITE TYPE B.1`       | `site_status_b`  | Site B é Existente ou Novo         |

Se o TIM corrigir os rótulos do CSV no futuro (ex: renomear para
"Infra Type A" e "Site Status A" diretamente), essas linhas em
`MANUAL_OVERRIDES` podem ser removidas — o `schema_loader.py` vai gerar o
nome interno certo automaticamente a partir do próprio rótulo.

## Grupos Planejado (P) x Realizado (R)

Colunas terminadas em `(P)` e `(R)` são automaticamente agrupadas pelo
mesmo "marco" (milestone), ex: `LOS Simulation (P)` e `LOS Simulation (R)`
formam o grupo `LOS Simulation`. Isso é usado pelo frontend para desenhar
cada etapa do processo como um par Planejado x Realizado lado a lado.
