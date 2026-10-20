# Removes MediaDrop for this user; run from Settings > Apps > MediaDrop > Uninstall.
# Downloaded media, settings and saved logins (%APPDATA%\mediadrop) are kept.
# Keep this file ASCII: Windows PowerShell 5.1 reads scripts without a BOM as ANSI.
$appDir = $PSScriptRoot
Set-Location $env:TEMP

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
