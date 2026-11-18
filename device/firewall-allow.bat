@echo off
title Adivasi Suraksha - Allow ESP32 on the local network
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo Asking for administrator permission...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Adding a private-network firewall rule for TCP port 5173...
netsh advfirewall firewall delete rule name="Adivasi Suraksha 5173" >nul 2>&1
netsh advfirewall firewall add rule name="Adivasi Suraksha 5173" dir=in action=allow protocol=TCP localport=5173 profile=private,domain

if errorlevel 1 (
  echo Could not add the rule. Allow Node.js on private networks in Windows Firewall settings.
) else (
  echo Done. The ESP32 can reach the server on the private Wi-Fi network.
  echo Keep the network set to Private, not Public.
)

echo.
pause
