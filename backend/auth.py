"""
auth.py
-------
Autenticação simples por senha única, compartilhada por todos os usuários
do dashboard. Não há cadastro de usuário/e-mail - só uma senha guardada em
variável de ambiente (backend/.env), comparada com a senha enviada no login.

Sessão:
    Depois de validar a senha, geramos um token assinado (HMAC-SHA256) que
    guarda só um timestamp de expiração. O token vai num cookie httpOnly,
    então o JavaScript do frontend nunca lê nem guarda a senha ou o token -
    o navegador manda o cookie sozinho em cada requisição. Não guardamos
    sessões em memória/banco: qualquer token com assinatura válida e ainda
    não expirado é aceito (stateless, sobrevive a restart do backend).

    A chave usada pra assinar o token é derivada de SESSION_SECRET + a
    senha atual. Isso significa que trocar a senha (endpoint
    /change-password) invalida automaticamente qualquer sessão aberta em
    outros navegadores, sem precisar de uma lista de sessões revogadas.

Troca de senha:
    /change-password grava a nova senha direto em backend/.env (a mesma
    variável DASHBOARD_PASSWORD lida na inicialização), então ela continua
    valendo depois de reiniciar o backend.
"""

import hashlib
import hmac
import os
import time

from dotenv import load_dotenv, set_key
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(ENV_PATH)

DASHBOARD_PASSWORD = os.environ.get("DASHBOARD_PASSWORD")
SESSION_SECRET = os.environ.get("SESSION_SECRET")

if not DASHBOARD_PASSWORD or not SESSION_SECRET:
    raise RuntimeError(
        "DASHBOARD_PASSWORD e SESSION_SECRET precisam estar definidos em backend/.env "
        "(copie backend/.env.example para backend/.env e preencha os dois valores)."
    )

COOKIE_NAME = "dashboard_session"
SESSION_MAX_AGE = 12 * 60 * 60  # 12 horas
# Em produção (HTTPS), defina COOKIE_SECURE=True no .env para o cookie só
# trafegar por conexão segura.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "False") == "True"

router = APIRouter(prefix="/api/auth")


def _signing_key() -> bytes:
    # Inclui a senha atual na chave de assinatura: trocar a senha muda a
    # chave e derruba na hora qualquer token emitido antes da troca.
    return hashlib.sha256(f"{SESSION_SECRET}:{DASHBOARD_PASSWORD}".encode()).digest()


def _sign(expires_at: str) -> str:
    return hmac.new(_signing_key(), expires_at.encode(), hashlib.sha256).hexdigest()


def _create_token() -> str:
    expires_at = str(int(time.time()) + SESSION_MAX_AGE)
    return f"{expires_at}.{_sign(expires_at)}"


def _token_is_valid(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    expires_at, _, signature = token.partition(".")
    if not expires_at.isdigit():
        return False
    if not hmac.compare_digest(signature, _sign(expires_at)):
        return False
    return int(expires_at) > int(time.time())


def require_auth(request: Request) -> None:
    """Dependência FastAPI: barra a rota se não houver sessão válida."""
    if not _token_is_valid(request.cookies.get(COOKIE_NAME)):
        raise HTTPException(status_code=401, detail="Não autenticado")


class LoginRequest(BaseModel):
    password: str


@router.post("/login")
def login(payload: LoginRequest, response: Response):
    if not hmac.compare_digest(payload.password, DASHBOARD_PASSWORD):
        raise HTTPException(status_code=401, detail="Senha incorreta")

    response.set_cookie(
        key=COOKIE_NAME,
        value=_create_token(),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        path="/",
    )
    return {"authenticated": True}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"authenticated": False}


@router.get("/me")
def me(request: Request):
    return {"authenticated": _token_is_valid(request.cookies.get(COOKIE_NAME))}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    _: None = Depends(require_auth),
):
    global DASHBOARD_PASSWORD

    if not hmac.compare_digest(payload.current_password, DASHBOARD_PASSWORD):
        raise HTTPException(status_code=401, detail="Senha atual incorreta")

    new_password = payload.new_password.strip()
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="A nova senha precisa ter pelo menos 6 caracteres")

    set_key(ENV_PATH, "DASHBOARD_PASSWORD", new_password)
    DASHBOARD_PASSWORD = new_password

    # A chave de assinatura depende da senha atual (ver _signing_key), então
    # trocar a senha invalida o token que acabou de ser usado para autenticar
    # essa própria requisição. Emitimos um novo token já com a chave nova
    # para não deslogar quem está trocando a senha.
    response.set_cookie(
        key=COOKIE_NAME,
        value=_create_token(),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        path="/",
    )
    return {"changed": True}
