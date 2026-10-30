@echo off
title UP Police Portal - Local Development Server
cls
echo ===================================================
echo   UP Police Directory - Start Local Dev Server
echo ===================================================
echo.

if exist "%~dp0\police-directory-app" (
    cd /d "%~dp0\police-directory-app"
) else (
    cd /d "%~dp0"
)

echo Starting Frontend Web & PWA on http://localhost:5173 ...
echo Press Ctrl+C in this window to stop the server.
echo.

call npm.cmd run dev --workspace=@police-directory/web
pause
