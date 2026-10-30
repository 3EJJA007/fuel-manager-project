@echo off
title FUEL//MANAGER - Angular & PostgreSQL Server
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
echo [INFO] Lancement du serveur unifie sur http://localhost:3000 ...
start http://localhost:3000

call npm start
pause
