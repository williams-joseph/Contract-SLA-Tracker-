@echo off
echo Cleaning up existing process on port 8055 (Admin Web)...

:: Kill process using PowerShell for better stability
powershell -Command "Get-NetTCPConnection -LocalPort 8055 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo Starting Admin Panel...
cd admin-web
npm run dev
pause
