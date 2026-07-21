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
data/        Banco de dados local (NÃO versionado no Git)
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

## Nota sobre dados

O banco de dados (`data/dashboard.db`) e planilhas Excel **não são
versionados neste repositório** (ver `.gitignore`) — contêm dados
operacionais da rede que não devem ficar em um histórico de código.
Cada pessoa mantém seu próprio banco local.
