@echo off
setlocal

set TARGET_EMAIL=%1
if "%TARGET_EMAIL%"=="" (
    set TARGET_EMAIL=leo.jaimes.estevez@gmail.com
)

echo =====================================================================
echo  PROPOSAL AUTOPILOT - PURGA TOTAL DE USUARIO Y TENANT
echo =====================================================================
echo  Email objetivo: %TARGET_EMAIL%
echo =====================================================================
echo.

type "%~dp0delete-user.js" | docker exec -i proposal_autopilot_backend node - %TARGET_EMAIL%

echo.
echo =====================================================================
echo  Proceso finalizado.
echo =====================================================================
pause
