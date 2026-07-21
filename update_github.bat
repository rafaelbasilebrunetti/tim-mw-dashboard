@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   TIM MW Dashboard - Enviar mudancas pro GitHub
echo ============================================
echo.

cd /d "%~dp0"

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Esta pasta ainda nao e um repositorio Git.
    echo Rode primeiro o setup_github.bat para configurar.
    pause
    exit /b 1
)

echo Verificando o que mudou...
git status --short
echo.

set /p CONFIRM="Deseja enviar essas mudancas pro GitHub? (S/N): "
if /i not "%CONFIRM%"=="S" (
    echo Cancelado.
    pause
    exit /b 0
)

set /p MSG="Descreva rapidamente o que mudou (ex: 'ajusta cores da tabela'): "
if "%MSG%"=="" set "MSG=Atualizacao do dashboard"

git add -A
git commit -m "%MSG%"

if errorlevel 1 (
    echo.
    echo Nao havia nada novo para enviar.
    pause
    exit /b 0
)

echo.
echo Enviando para o GitHub...
git push

if errorlevel 1 (
    echo.
    echo [ERRO] O envio falhou. Motivos comuns:
    echo   - Sem conexao com a internet
    echo   - Precisa fazer login no Git/GitHub novamente
    echo   - Alguem enviou mudancas antes de voce ^(rode "git pull" e tente de novo^)
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Mudancas enviadas com sucesso!
echo ============================================
pause
endlocal
