# TIM MW · SP Preliminary Report — Dashboard

Painel de acompanhamento de links de microondas (MW) da TIM. Lê seu
padrão de dados a partir de um template CSV (`config/templates/`),
gera o schema do banco automaticamente, e disponibiliza uma API +
interface web para consultar, editar e importar registros.

## Estrutura

```
backend/     API em Python (FastAPI) + banco SQLite
frontend/    Interface web em React
config/      Template CSV que define o padrão de campos (schema)
data/        Banco de dados, planilha principal e backups (NÃO versionado no Git)
```

## Como rodar localmente

**1. Backend:**
```powershell
cd backend
pip install -r requirements.txt
python app.py
```

**2. Frontend** (em outro terminal):
```powershell
cd frontend
npm install
npm run dev
```

Depois abra `http://localhost:5173`.

Ou use `start_dashboard.bat` na raiz do projeto para subir os dois de
uma vez.

## Login / senha do dashboard

O acesso ao dashboard é protegido por uma senha única (sem usuário/e-mail).
A senha correta e a chave de sessão ficam em `backend/.env`, que **não é
versionado**.

**1. Crie o arquivo de configuração:**
```powershell
cd backend
copy .env.example .env
```

**2. Edite `backend/.env` e defina:**
```
DASHBOARD_PASSWORD=sua-senha-aqui
SESSION_SECRET=uma-string-aleatoria-e-secreta
```
Para gerar uma `SESSION_SECRET` aleatória:
```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Sem esse arquivo (ou sem essas duas variáveis definidas), o backend recusa
subir — isso é intencional, para garantir que a senha nunca fique
hardcoded no código.

**Como funciona:** ao acessar o dashboard, o frontend mostra uma tela de
login pedindo a senha. Se estiver correta, o backend gera um cookie de
sessão `httpOnly` (assinado, válido por 12h) e libera o acesso às rotas da
API; sem esse cookie válido, qualquer chamada à API retorna 401 e o
frontend volta para a tela de login. O botão "Sair" no cabeçalho invalida
a sessão (logout).

Em produção, sirva o dashboard via HTTPS e defina `COOKIE_SECURE=True` no
`.env` para o cookie de sessão exigir conexão segura.

## Importando dados existentes

```powershell
cd backend
python import_data.py "../data/seu_controle.xlsx" --upsert
```

Veja `config/templates/README.md` para detalhes sobre como editar o
padrão (schema) de campos.

## Persistência: como os dados são salvos

O dashboard tem duas camadas de armazenamento, mantidas sempre sincronizadas:

- **`data/dashboard.db`** (SQLite) — é o que a API lê e escreve a cada
  requisição (rápido, com índices, é o "motor" do dashboard).
- **`data/seu_controle.xlsx`** — é a planilha "viva": a mesma que serve de
  controle do projeto, sempre com os dados atualizados, para abrir e
  conferir fora do app se precisar.

**Toda alteração feita pela interface** (criar site, editar qualquer campo,
excluir, ou o preenchimento automático de Site A/B via planilha de
referência) faz duas coisas, na mesma operação:

1. Grava no banco (`dashboard.db`).
2. Regrava a planilha inteira (`seu_controle.xlsx`) a partir do estado
   atual do banco — por isso um site novo cadastrado pela tela "+ Adicionar
   Site" aparece como uma linha nova na planilha, com exatamente as mesmas
   colunas dos registros que já existiam.

**Ao subir o backend**, ele relê `seu_controle.xlsx` e mescla o conteúdo no
banco (por TIM Key) — ou seja, a planilha é a fonte "viva": se o arquivo do
banco for perdido, apagado ou corrompido, o app reconstrói os dados a
partir dela.

**Proteção contra corrupção:** a planilha nunca é editada célula a célula.
A cada gravação, o app monta o arquivo novo do zero num arquivo temporário
e só troca pelo arquivo original (`os.replace`, operação atômica) depois
que essa escrita termina sem erro — então uma queda de energia ou erro no
meio do processo nunca deixa `seu_controle.xlsx` corrompido ou pela metade.

**Backups automáticos:** antes de cada substituição, a versão anterior da
planilha é copiada para `data/backups/`, com o nome
`seu_controle_AAAAMMDD_HHMMSS.xlsx`. As últimas 30 cópias são mantidas;
backups mais antigos são apagados automaticamente. Essa pasta não é
versionada no Git (mesma regra dos outros dados).

**Se a gravação falhar** (por exemplo, o arquivo `seu_controle.xlsx` estiver
aberto no Excel, disco cheio, ou permissão negada), a alteração é **desfeita
por completo** — nada fica salvo só no banco sem refletir na planilha — e a
interface mostra uma mensagem de erro explícita, para nunca dar a entender
que algo foi salvo quando na verdade não foi. Nesse caso, feche o arquivo
no Excel (ou resolva a causa do erro) e tente salvar de novo.

A importação em massa (botão "Importar Dados") também atualiza a planilha
principal depois de importar; se esse passo falhar, os dados já importados
continuam no banco e o relatório da tela avisa que a planilha ainda não
reflete a importação.

## Planilha de referência de sites (preenchimento automático)

Toda vez que a tela de detalhe de um site é aberta (clicando numa linha da
tabela), o backend busca Site A e Site B numa planilha de referência
externa e maior (cadastro de sites da rede, **não é o mesmo arquivo**
usado para importar links) e **preenche automaticamente, direto nos
campos do próprio site** (End ID, Infra Type, Município, Detentora,
Latitude, Longitude — de A e de B), os que ainda estiverem vazios. Campos
já preenchidos (manualmente ou por import) nunca são sobrescritos.

**Onde colocar:** `data/site_reference.xlsb` (ou `data/site_reference.xlsx`,
se preferir converter). Não é versionado no Git.

**Formato esperado** (colunas identificadas por **letra**, não por nome —
a primeira linha é tratada como cabeçalho e ignorada):

| Coluna | Conteúdo             |
|--------|-----------------------|
| A      | Site ID (chave de busca, deve bater com Site A/Site B do dashboard) |
| E      | Endereço ID (END ID)  |
| H      | Detentor da área      |
| R      | Cidade (Município)    |
| AB     | Tipo de Infra         |
| AC     | Latitude              |
| AD     | Longitude             |

A busca é feita pelo Site ID (coluna A); todas as demais informações vêm
da mesma linha encontrada. Se um site aparecer em mais de uma linha com
dados diferentes, prevalece a linha com a "Data última alteração" (coluna
AA) mais recente. Site não encontrado na planilha aparece como "Não
encontrado" na tela, sem quebrar nada.

Planilhas grandes (testado com ~300 mil linhas) são carregadas uma única
vez em memória e cacheadas (só recarrega se o arquivo mudar) — a primeira
consulta após subir o backend pode demorar dezenas de segundos; as
seguintes são instantâneas.

## Nota sobre dados

O banco de dados (`data/dashboard.db`) e planilhas Excel **não são
versionados neste repositório** (ver `.gitignore`) — contêm dados
operacionais da rede que não devem ficar em um histórico de código.
Cada pessoa mantém seu próprio banco local.
