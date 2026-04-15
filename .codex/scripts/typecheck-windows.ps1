$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\\..")

npx tsc --noEmit
