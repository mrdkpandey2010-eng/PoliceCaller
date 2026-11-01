@echo off
title UP Police Portal - Sync Host & Send Backup to Telegram
cls
echo =========================================================================
echo   UP POLICE DIRECTORY - HOST DATA SYNC & TELEGRAM BACKUP
echo =========================================================================
echo.

set /p SUBJECT="Enter update subject / message (Optional, press Enter for default): "

if exist "%~dp0\auto_sync_and_backup.py" (
    python "%~dp0\auto_sync_and_backup.py" "%SUBJECT%"
) else if exist "%~dp0\..\auto_sync_and_backup.py" (
    python "%~dp0\..\auto_sync_and_backup.py" "%SUBJECT%"
) else (
    echo [ERROR] auto_sync_and_backup.py not found!
)

echo.
pause
