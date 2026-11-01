@echo off
setlocal enabledelayedexpansion
title UP Police Directory - One-Click Setup & Launch
color 0B
cls

echo =========================================================================
echo    UTTAR PRADESH POLICE DIRECTORY & REALTIME MESSENGER PORTAL
echo         AUTOMATIC ONE-CLICK ZERO-DEPENDENCY SETUP & RUNNER
echo =========================================================================
echo.

:: Detect working directory
if exist "%~dp0\police-directory-app" (
    cd /d "%~dp0\police-directory-app"
) else (
    cd /d "%~dp0"
)

echo [Step 1/3] Checking Node.js Environment...
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] System Node.js detected:
    for /f "tokens=*" %%v in ('node -v') do echo      Node Version: %%v
) else if exist ".tools\node\node.exe" (
    echo [OK] Portable Node.js detected in .tools folder.
    set "PATH=%CD%\.tools\node;%PATH%"
) else (
    echo [NOTICE] Node.js is not installed on this system.
    echo [AUTO-SETUP] Downloading official portable Node.js runtime...
    echo (No administrator permissions or installation required)...
    echo.
    if not exist ".tools" mkdir .tools
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$url = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip';" ^
        "$zip = '.tools\node.zip';" ^
        "Write-Host 'Downloading portable runtime (approx 30 MB)...';" ^
        "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
        "Invoke-WebRequest -Uri $url -OutFile $zip;" ^
        "Write-Host 'Extracting Node.js runtime...';" ^
        "Expand-Archive -Path $zip -DestinationPath '.tools\temp' -Force;" ^
        "Move-Item '.tools\temp\node-v20.18.0-win-x64' '.tools\node' -Force;" ^
        "Remove-Item '.tools\temp' -Recurse -Force;" ^
        "Remove-Item $zip -Force;"
    
    if exist ".tools\node\node.exe" (
        set "PATH=%CD%\.tools\node;%PATH%"
        echo [OK] Portable Node.js is ready!
    ) else (
        echo [ERROR] Automatic portable Node.js download failed.
        echo Please ensure you have internet access or install Node.js from https://nodejs.org
        pause
        exit /b 1
    )
)

echo.
echo [Step 2/3] Checking Project Dependencies...
if not exist "node_modules" (
    echo First-time setup detected on this computer.
    echo Installing local dependencies (node_modules)...
    call npm.cmd install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b %ERRORLEVEL%
    )
) else (
    echo [OK] Dependencies are already present.
)

echo.
echo [Step 3/3] Launching UP Police Directory Application...
echo.
echo =========================================================================
echo   * Host Data Included: All 75 Districts, 2,179 Stations/Offices, Users
echo   * Local Database:     local_database.sqlite / database_backup.sql
echo   * Web Portal URL:     http://localhost:5173
echo =========================================================================
echo.
echo Launching browser and starting local development server...
echo (Press Ctrl+C to stop the server at any time)
echo.

:: Automatically open browser after 3 seconds
start "" cmd /c "timeout /t 3 >nul && start http://localhost:5173"

:: Run local web server
call npm.cmd run dev --workspace=@police-directory/web
pause
