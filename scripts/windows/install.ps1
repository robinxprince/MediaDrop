# MediaDrop installer for Windows, run by "Install MediaDrop.cmd" next to it.
# Installs the app for this user (no administrator rights needed), the Premiere Pro panel,
# Start menu and desktop shortcuts and an entry in Settings > Apps, then opens MediaDrop.
# MediaDrop's updater runs it hidden with -Update: no desktop shortcut, and no prompts.
# Keep this file ASCII: Windows PowerShell 5.1 reads scripts without a BOM as ANSI.
param([switch]$Update)
$ErrorActionPreference = "Stop"

$src = $PSScriptRoot
$appDir = Join-Path $env:LOCALAPPDATA "Programs\MediaDrop"
$exe = Join-Path $appDir "MediaDrop.exe"
$version = (Get-Content (Join-Path $src "MediaDrop\resources\app\package.json") -Raw | ConvertFrom-Json).version

# MediaDrop and the yt-dlp, ffmpeg and ffprobe it runs, from the installed copy only
function Get-AppProcesses {
  Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith("$appDir\", [StringComparison]::OrdinalIgnoreCase) }
}

# Windows releases file handles a moment after a process exits, so retry briefly
function Invoke-WithRetry([scriptblock]$action) {
  for ($i = 1; ; $i++) {
    try { & $action; return } catch { if ($i -ge 10) { throw }; Start-Sleep -Milliseconds 500 }
  }
}

try {
  Write-Host "=================================================="
  Write-Host "          MediaDrop $version Installer for Windows"
  Write-Host "=================================================="
  Write-Host ""

  # 1. App. The new copy is staged beside the old one, so a failed install leaves the old one working.
  Write-Host "[1/4] Installing MediaDrop to $appDir"
  $running = @(Get-AppProcesses)
  if ($running.Count) {
    # An update waits for the MediaDrop that started it to quit
    $running | Wait-Process -Timeout 15 -ErrorAction SilentlyContinue
    Get-AppProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
  }
  $staged = "$appDir.new"
  $previous = "$appDir.old"
  foreach ($dir in $staged, $previous) { if (Test-Path $dir) { Invoke-WithRetry { Remove-Item $dir -Recurse -Force } } }
  New-Item (Split-Path $appDir) -ItemType Directory -Force | Out-Null
  Copy-Item (Join-Path $src "MediaDrop") $staged -Recurse
  # Files unzipped from a download carry the "from the internet" mark; clear it like xattr does on macOS
  Get-ChildItem $staged -Recurse -File | Unblock-File
  if (Test-Path $appDir) { Invoke-WithRetry { Rename-Item $appDir $previous } }
  try {
    Invoke-WithRetry { Rename-Item $staged $appDir }
  } catch {
    if (Test-Path $previous) { Rename-Item $previous $appDir }
    throw
  }
  if (Test-Path $previous) { Remove-Item $previous -Recurse -Force -ErrorAction SilentlyContinue }
  Write-Host "  OK  MediaDrop installed"

  # 2. Premiere loads unsigned CEP panels only with PlayerDebugMode on
  Write-Host "[2/4] Configuring Adobe Premiere Pro CEP extensions"
  foreach ($v in 11..20) {
    $key = "HKCU:\Software\Adobe\CSXS.$v"
    if (-not (Test-Path $key)) { New-Item $key -Force | Out-Null }
    Set-ItemProperty $key -Name PlayerDebugMode -Value "1"
  }
  Write-Host "  OK  CEP PlayerDebugMode enabled"

  # 3. Premiere Pro panel
  Write-Host "[3/4] Installing the Premiere Pro bridge"
  $cepDir = Join-Path $env:APPDATA "Adobe\CEP\extensions"
  $extDir = Join-Path $cepDir "MediaDropBackend"
  New-Item $cepDir -ItemType Directory -Force | Out-Null
  if (Test-Path $extDir) { Invoke-WithRetry { Remove-Item $extDir -Recurse -Force } }
  Copy-Item (Join-Path $src "premiere-extension") $extDir -Recurse
  Get-ChildItem $extDir -Recurse -File | Unblock-File
  Write-Host "  OK  Premiere Pro panel installed to $extDir"

  # 4. Shortcuts and the Settings > Apps entry
  Write-Host "[4/4] Adding shortcuts"
  $shell = New-Object -ComObject WScript.Shell
  $shortcuts = @(Join-Path ([Environment]::GetFolderPath("Programs")) "MediaDrop.lnk")
  if (-not $Update) { $shortcuts += Join-Path ([Environment]::GetFolderPath("Desktop")) "MediaDrop.lnk" }
  foreach ($path in $shortcuts) {
    $link = $shell.CreateShortcut($path)
    $link.TargetPath = $exe
    $link.WorkingDirectory = $appDir
    $link.Description = "MediaDrop"
    $link.Save()
  }
  $uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\MediaDrop"
  if (-not (Test-Path $uninstallKey)) { New-Item $uninstallKey -Force | Out-Null }
  $powershell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
  $entry = @{
    DisplayName = "MediaDrop"
    DisplayVersion = $version
    Publisher = "robinxprince"
    DisplayIcon = $exe
    InstallLocation = $appDir
    URLInfoAbout = "https://github.com/robinxprince/MediaDrop"
    UninstallString = "`"$powershell`" -NoProfile -ExecutionPolicy Bypass -File `"$appDir\uninstall.ps1`""
  }
  foreach ($name in $entry.Keys) { Set-ItemProperty $uninstallKey -Name $name -Value $entry[$name] }
  foreach ($name in "NoModify", "NoRepair") { Set-ItemProperty $uninstallKey -Name $name -Value 1 -Type DWord }
  Write-Host "  OK  Start menu shortcut added"

  Write-Host ""
  Write-Host "=================================================="
  Write-Host "            INSTALLATION COMPLETE"
  Write-Host "=================================================="
  Write-Host "1. If Adobe Premiere Pro is open, quit it and open it again."
  Write-Host "2. Open a project with a sequence in Premiere."
  Write-Host "3. Opening MediaDrop now..."
  Start-Process $exe
} catch {
  Write-Host ""
  Write-Host "Installation failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Close MediaDrop and Premiere Pro, then run Install MediaDrop.cmd again."
  exit 1
}
