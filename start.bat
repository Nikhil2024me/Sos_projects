@echo off
title Adivasi Suraksha - Local Server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org and try again.
  pause
  exit /b 1
)
node serve.js 5173 --open
pause
