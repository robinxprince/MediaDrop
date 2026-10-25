@echo off
rem Runs the installed MediaDrop's uninstaller (it only runs from the install folder)
set "UNINSTALLER=%LOCALAPPDATA%\Programs\MediaDrop\uninstall.ps1"
if not exist "%UNINSTALLER%" (
  echo MediaDrop isn't installed for this Windows account.
  pause
  exit /b 1
)
echo Removes MediaDrop and its Premiere Pro panel. Your downloaded media stays where it is.
echo.
choice /c YN /n /m "Also delete MediaDrop's settings and saved logins? [Y/N] "
if errorlevel 2 (set "DATA=") else (set "DATA=-RemoveData")
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%UNINSTALLER%" %DATA%
echo MediaDrop is uninstalled. Restart Premiere Pro if it's open.
echo.
pause
