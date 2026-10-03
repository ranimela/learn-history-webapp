@echo off
title History Quest - Battle Arena
cd /d "%~dp0"

echo ========================================================
echo           HISTORY QUEST - CHRONO BATTLE ARENA
echo ========================================================
echo.
echo Launching History Quest local server...
echo Access URL: http://localhost:3000
echo Passcode:   history123
echo.

:: Open default browser after a brief delay for server initialization
start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3000'"

:: Start the Next.js development server
npm run dev
