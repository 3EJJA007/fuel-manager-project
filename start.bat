@echo off
title FUEL//MANAGER - Serveur de demarrage
echo =======================================================
echo    FUEL//MANAGER - Projet ISET Charguia
echo    Demarrage automatique de l'application...
echo =======================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe sur ce PC !
    echo Veuillez telecharger et installer Node.js depuis : https://nodejs.org
    pause
    exit /b
)

if not exist node_modules (
    echo [INFO] Premier lancement detecte : Installation des dependances...
    call npm install
)

echo.
echo [INFO] Lancement du serveur sur http://localhost:3000 ...
echo [INFO] Ouverture automatique dans votre navigateur...
start http://localhost:3000

call npm start
pause

