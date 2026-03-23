@echo off
setlocal
echo ==============================================
echo   ECOWAS / CCJ - Application Starter
echo ==============================================
echo.
echo 1. Cleaning up existing processes...

:: Kill processes using PowerShell for better stability
echo [API - 5000] Cleaning...
powershell -Command "Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo [Main - 8054] Cleaning...
powershell -Command "Get-NetTCPConnection -LocalPort 8054 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo [Admin - 8055] Cleaning...
powershell -Command "Get-NetTCPConnection -LocalPort 8055 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo 2. Launching applications...

:: Start the API first in its own window
echo Starting API...
start "CCJ API — 5000" /D "." cmd /c "run_api.bat"

:: Small delay to let API initialize and read .env
timeout /t 3 /nobreak > nul

:: Start the Web frontends
echo Starting Frontends...
start "Main Web — 8054" /D "." cmd /c "run_main.bat"
start "Admin Panel — 8055" /D "." cmd /c "run_admin.bat"

echo.
echo ==============================================
echo   DONE! Use the individual windows to debug.
echo ==============================================
echo.
pause
