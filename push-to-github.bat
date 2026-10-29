@echo off
title UP Police Portal - GitHub Sync
cls
echo ===================================================
echo   UP Police Directory - Push to GitHub
echo ===================================================
echo.

cd /d "%~dp0\police-directory-app" 2>nul || cd /d "%~dp0"

echo [1/2] Verifying Git Remote...
git remote set-url origin https://github.com/mrdkpandey2010-eng/PoliceCaller.git
git remote -v

echo.
echo [2/2] Pushing main branch to GitHub...
git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ---------------------------------------------------
    echo If the remote repository was initialized with a README,
    echo attempting force sync to overwrite empty remote...
    echo ---------------------------------------------------
    git push -u origin main --force
)

echo.
if %ERRORLEVEL% EQU 0 (
    echo ===================================================
    echo [SUCCESS] Code successfully pushed to GitHub!
    echo URL: https://github.com/mrdkpandey2010-eng/PoliceCaller
    echo ===================================================
) else (
    echo ===================================================
    echo [NOTICE] If GitHub asked for login, complete the sign-in
    echo in your browser window to finish authentication.
    echo ===================================================
)

echo.
pause
