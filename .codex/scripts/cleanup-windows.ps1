$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\\..")

if (Test-Path .next) {
  Remove-Item -LiteralPath .next -Recurse -Force
}
