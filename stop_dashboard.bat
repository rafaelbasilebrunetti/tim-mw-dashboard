@echo off
echo Encerrando servidores do TIM MW Dashboard...
echo.

rem Fecha as janelas de terminal pelo titulo que o start_dashboard.bat usou
taskkill /FI "WINDOWTITLE eq TIM MW Dashboard - Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq TIM MW Dashboard - Frontend*" /T /F >nul 2>&1

echo Feito. Se alguma janela nao fechou sozinha, pode fecha-la manualmente.
pause
