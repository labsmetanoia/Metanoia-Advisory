@echo off
rem Magic Layers launcher for Windows. Double-click this file.
title Magic Layers
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Magic Layers needs Node.js ^(free^). Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)
if not exist "app\vendor\tesseract\tesseract.min.js" (
  echo First start: installing the app libraries ^(about a minute, needs internet once^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Install failed. Check the internet connection and try again.
    pause
    exit /b 1
  )
)
node server.mjs
if errorlevel 1 pause
