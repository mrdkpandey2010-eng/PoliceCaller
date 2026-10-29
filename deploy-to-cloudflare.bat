@echo off
title UP Police Portal - Cloudflare Live Deployment
cls
echo ===================================================
echo   UP Police Directory - Cloudflare Deployment
echo ===================================================
echo.

if exist "%~dp0\police-directory-app" (
    cd /d "%~dp0\police-directory-app"
) else (
    cd /d "%~dp0"
)

echo [1/3] Building Production Web & PWA Bundle...
call npm.cmd run build --workspace=@police-directory/web
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Web build failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Deploying Cloudflare Workers API Gateway...
echo (If this is your first time, a browser window will open for Cloudflare login)
cd apps\api
call npx.cmd wrangler deploy
cd ..\..

echo.
echo [3/3] Deploying Frontend PWA to Cloudflare Pages...
call npx.cmd wrangler pages deploy apps\web\dist --project-name=police-directory-app

echo.
echo ===================================================
echo [SUCCESS] UP Police Portal is Live on Cloudflare!
echo ===================================================
echo.
pause
