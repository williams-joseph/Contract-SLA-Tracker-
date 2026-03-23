@echo off
echo Cleaning up existing process on port 5000 (CCJ API)...

:: Kill process using PowerShell
powershell -Command "Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo Starting Backend API...
cd api
npm run dev
pause
