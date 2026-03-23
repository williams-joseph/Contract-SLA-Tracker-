@echo off
echo Cleaning up existing process on port 8054 (Main Web)...

:: Kill process using PowerShell for better stability
powershell -Command "Get-NetTCPConnection -LocalPort 8054 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo Starting Main Web dashboard...
cd main-web
npm run dev
pause
