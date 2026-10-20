@echo off
rem Runs the MediaDrop installer, install.ps1 next to this file
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
