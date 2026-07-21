@echo off
setlocal

rem %~dp0 = pasta onde este arquivo .bat esta salvo (com barra no final)
rem Isso funciona mesmo estando dentro de "TIM MW Report", com espacos no caminho.
set "PROJECT_DIR=%~dp0"

echo ============================================
echo   TIM MW SP - Iniciando Dashboard
echo ============================================
echo.

if not exist "%PROJECT_DIR%backend\app.py" (
    echo [ERRO] Nao encontrei backend\app.py em:
    echo   %PROJECT_DIR%backend
    echo Verifique se este arquivo .bat esta na raiz do projeto.
    pause
    exit /b 1
)

if not exist "%PROJECT_DIR%frontend\package.json" (
    echo [ERRO] Nao encontrei frontend\package.json em:
    echo   %PROJECT_DIR%frontend
    echo Verifique se este arquivo .bat esta na raiz do projeto.
    pause
    exit /b 1
)

rem A instalacao "python" padrao (3.12) desta maquina esta com a pasta Lib
rem corrompida (falta encodings, os.py etc.) e nao consegue nem iniciar o
rem interpretador. Usamos o launcher "py -3.14", que aponta para uma
rem instalacao integra com as dependencias do backend ja instaladas.
echo Abrindo terminal do Backend (FastAPI)...
start "TIM MW Dashboard - Backend" cmd /k "cd /d "%PROJECT_DIR%backend" && py -3.14 app.py"

echo Abrindo terminal do Frontend (React)...
start "TIM MW Dashboard - Frontend" cmd /k "cd /d "%PROJECT_DIR%frontend" && npm run dev"

echo.
echo Aguardando os servidores subirem...
timeout /t 6 /nobreak >nul

echo Abrindo o dashboard no navegador...
start "" "http://localhost:5173"

echo.
echo ============================================
echo   Pronto! Duas janelas de terminal ficaram
echo   abertas rodando o backend e o frontend.
echo   Feche essas janelas para desligar os
echo   servidores.
echo ============================================
echo.
pause
endlocal
