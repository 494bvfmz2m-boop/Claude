@echo off
title EderveenGroup
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   EderveenGroup needs Node.js ^(free^). Opening the download page...
  echo   Install the LTS version, then double-click this file again.
  start "" https://nodejs.org/
  pause
  exit /b 1
)
set OPEN_BROWSER=1
node server.js
echo.
echo   EderveenGroup stopped.
pause
