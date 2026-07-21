@echo off
setlocal

echo ============================================
echo   TIM MW Dashboard - Configuracao inicial do Git
echo ============================================
echo.
echo ANTES DE CONTINUAR, crie um repositorio vazio no GitHub:
echo   1. Acesse https://github.com/new
echo   2. De um nome (ex: tim-mw-dashboard)
echo   3. NAO marque "Add a README" nem ".gitignore" - deixe vazio
echo   4. Clique em "Create repository"
echo   5. Copie a URL que aparece (algo como
echo      https://github.com/SEU-USUARIO/tim-mw-dashboard.git)
echo.
pause

cd /d "%~dp0"

git rev-parse --is-inside-work-tree >nul 2>&1
if not errorlevel 1 (
    echo Esta pasta ja e um repositorio Git. Nada a fazer aqui.
    echo Se quiser trocar o repositorio remoto, use:
    echo   git remote set-url origin NOVA_URL
    pause
    exit /b 0
)

git init
git branch -M main

set /p REPO_URL="Cole aqui a URL do repositorio que voce criou no GitHub: "
if "%REPO_URL%"=="" (
    echo Nenhuma URL informada. Cancelado.
    pause
    exit /b 1
)

git remote add origin "%REPO_URL%"

echo.
echo Preparando o primeiro commit (isso pode levar alguns segundos)...
git add -A
git commit -m "Primeiro commit - dashboard TIM MW SP"

echo.
echo Enviando para o GitHub...
git push -u origin main

if errorlevel 1 (
    echo.
    echo [ERRO] O envio falhou. Verifique:
    echo   - Se voce esta logado no Git ^(pode abrir uma janela do navegador
    echo     pedindo login no GitHub - faca login normalmente^)
    echo   - Se a URL do repositorio esta correta
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Repositorio configurado com sucesso!
echo   A partir de agora, use update_github.bat
echo   sempre que quiser enviar novas mudancas.
echo ============================================
pause
endlocal
