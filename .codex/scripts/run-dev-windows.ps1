$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\\..")

npx next dev --hostname 0.0.0.0 --port 3000
