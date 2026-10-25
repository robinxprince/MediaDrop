@echo off
rem Runs the MediaDrop installer, install.ps1 next to this file
if not exist "%~dp0install.ps1" (
  echo This installer was opened from inside the zip, so Windows copied only this one file.
  echo.
  echo Right-click the MediaDrop zip, choose "Extract All...", open the extracted
  echo MediaDrop-Setup folder and double-click "Install MediaDrop.cmd" there.
  echo.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
