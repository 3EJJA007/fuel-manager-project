@echo off
title FUEL//MANAGER - Upload GitHub
echo ========================================================
echo   Envoi du projet vers https://github.com/3EJJA007/fuel-manager-project
echo ========================================================
echo.
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo [SUCCES] Le projet a ete publie sur GitHub avec succes !
) else (
    echo [INFO] En cas de probleme d'autorisation, verifiez votre compte GitHub.
)
echo.
pause

