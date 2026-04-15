$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\\..")

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed on Windows PATH."
}

npm install
