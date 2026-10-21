# Removes MediaDrop for this user; run from Settings > Apps > MediaDrop > Uninstall.
# Downloaded media, settings and saved logins (%APPDATA%\mediadrop) are kept.
# Keep this file ASCII: Windows PowerShell 5.1 reads scripts without a BOM as ANSI.
$appDir = $PSScriptRoot
Set-Location $env:TEMP

# Only ever remove the real install folder, even if this script is copied and run somewhere else
$expected = Join-Path $env:LOCALAPPDATA "Programs\MediaDrop"
if (-not $appDir -or -not [string]::Equals($appDir.TrimEnd("\"), $expected, [StringComparison]::OrdinalIgnoreCase)) {
  Write-Host "This uninstaller only runs from $expected" -ForegroundColor Red
  exit 1
}

Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -and $_.Path.StartsWith("$appDir\", [StringComparison]::OrdinalIgnoreCase) } |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

$paths = @(
  (Join-Path ([Environment]::GetFolderPath("Programs")) "MediaDrop.lnk"),
  (Join-Path ([Environment]::GetFolderPath("Desktop")) "MediaDrop.lnk"),
  (Join-Path $env:APPDATA "Adobe\CEP\extensions\MediaDropBackend"),
  "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\MediaDrop",
  $appDir
)
foreach ($path in $paths) {
  if (Test-Path $path) { Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue }
}

# Put back Adobe's PlayerDebugMode where MediaDrop turned it on and it's still on;
# a value someone changed since then is left as they set it
$backupKey = "HKCU:\Software\MediaDrop\CEPDebugMode"
if (Test-Path $backupKey) {
  $backup = Get-ItemProperty $backupKey
  foreach ($name in $backup.PSObject.Properties.Name -match '^CSXS\.\d+$') {
    $key = "HKCU:\Software\Adobe\$name"
    if ((Get-ItemProperty $key -Name PlayerDebugMode -ErrorAction SilentlyContinue).PlayerDebugMode -ne "1") { continue }
    if ($backup.$name -eq "") { Remove-ItemProperty $key -Name PlayerDebugMode -ErrorAction SilentlyContinue }
    else { Set-ItemProperty $key -Name PlayerDebugMode -Value $backup.$name }
  }
  Remove-Item "HKCU:\Software\MediaDrop" -Recurse -Force -ErrorAction SilentlyContinue
}
