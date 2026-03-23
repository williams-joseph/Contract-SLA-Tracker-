@echo off
echo ==============================================
echo   CCJ SLA Tracker - Database Setup
echo ==============================================
echo.
echo THIS WILL RESET ALL YOUR DATA. 
echo Make sure PostgreSQL is running and "ccj_contracts" DB exists.
echo.
pause

echo 1. Initializing Tables and Admin...
cd api
node src/scripts/initDb.js

echo.
echo 2. Importing Data from Excel...
node src/scripts/importExcel.js

echo.
echo ==============================================
echo   SETUP COMPLETE!
echo   Admin: eamoakwa@courtecowas.org
echo   Pass: password123#
echo ==============================================
echo.
cd ..
pause
