"""
app.py
------
Ponto de entrada do backend. Cria a tabela (se não existir), habilita
CORS para o frontend React, e registra as rotas.

Rodar com:
    python app.py
ou
    uvicorn app:app --reload
"""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import require_auth
from auth import router as auth_router
from database import create_table
from routes import router

app = FastAPI(title="TIM MW Report Dashboard API")

# Libera acesso do frontend React (rodando em localhost:5173 por padrão no Vite)
# allow_credentials=True + lista explícita de origens é obrigatório para o
# cookie de sessão (httpOnly) trafegar entre frontend e backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas de login/logout/me ficam abertas (sem exigir sessão).
app.include_router(auth_router)
# Todo o resto da API (schema, links) exige sessão válida.
app.include_router(router, dependencies=[Depends(require_auth)])


@app.on_event("startup")
def on_startup():
    create_table()


@app.get("/")
def root():
    return {"status": "ok", "service": "TIM MW Report Dashboard API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
