@echo off
title FUEL//MANAGER - Angular and PostgreSQL Server
echo =======================================================
echo    FUEL//MANAGER - Projet ISET Charguia
echo    Frontend : Angular 21
echo    Database : PostgreSQL 18 (fuel_manager_db)
echo    Encadre par : Mme Sonia Gannar
echo =======================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe sur ce PC !
    echo Veuillez telecharger Node.js depuis https://nodejs.org
    pause
    exit /b
)

if not exist node_modules (
    echo [INFO] Installation des modules backend...
    call npm install
)

if not exist frontend\dist\frontend\browser (
    echo [INFO] Compilation initiale d'Angular en cours...
    call npm run build
)

echo.
echo [INFO] Verification du service PostgreSQL...
powershell -Command "if (Test-Path 'C:\Program Files\PostgreSQL\18\data\postmaster.pid') { $pidNum = (Get-Content 'C:\Program Files\PostgreSQL\18\data\postmaster.pid')[0].Trim(); if (-not (Get-Process -Id $pidNum -ErrorAction SilentlyContinue)) { Remove-Item 'C:\Program Files\PostgreSQL\18\data\postmaster.pid' -Force } }; if (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -InformationLevel Quiet)) { & 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' start -D 'C:\Program Files\PostgreSQL\18\data' }" >nul 2>nul

echo.
echo [INFO] Lancement du serveur sur http://localhost:3000 ...
start http://localhost:3000

call npm start
pause
