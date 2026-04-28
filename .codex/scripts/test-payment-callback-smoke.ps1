$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\\..")

$defaultSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
$defaultSupabaseServiceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

function Resolve-SupabaseCli {
  $localCli = Join-Path (Get-Location) "node_modules\\.bin\\supabase.cmd"
  if (Test-Path $localCli) {
    return @{
      FilePath = $localCli
      PrefixArgs = @()
    }
  }

  $globalCli = Get-Command supabase.exe -ErrorAction SilentlyContinue
  if ($globalCli) {
    return @{
      FilePath = $globalCli.Source
      PrefixArgs = @()
    }
  }

  $cachedCli = Get-ChildItem (Join-Path $env:LOCALAPPDATA "npm-cache\\_npx") -Filter "supabase.cmd" -Recurse -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
  if ($cachedCli) {
    return @{
      FilePath = $cachedCli
      PrefixArgs = @()
    }
  }

  if (Get-Command npx.cmd -ErrorAction SilentlyContinue) {
    return @{
      FilePath = "npx.cmd"
      PrefixArgs = @("supabase")
    }
  }

  throw "Supabase CLI is not available on Windows. Install it as a local dev dependency (`npm install supabase --save-dev`) or warm the npx cache first."
}

function Get-SupabaseApiUrlFromConfig {
  $configPath = Join-Path (Get-Location) "supabase\\config.toml"
  if (-not (Test-Path $configPath)) {
    return $null
  }

  $configContent = Get-Content $configPath -Raw
  $apiPortMatch = [regex]::Match($configContent, "(?ms)^\[api\].*?^port\s*=\s*(\d+)")
  if (-not $apiPortMatch.Success) {
    return $null
  }

  return "http://127.0.0.1:$($apiPortMatch.Groups[1].Value)"
}

function Wait-ForSupabaseApi {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl
  )

  $healthUrl = "$($ApiUrl.TrimEnd('/'))/auth/v1/health"
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Seconds 2
      continue
    }
    Start-Sleep -Seconds 2
  }

  throw "Supabase API did not become ready: $healthUrl"
}

function Invoke-ExternalCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [Parameter(Mandatory = $true)]
    [string[]]$ArgumentList
  )

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & $FilePath @ArgumentList
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    throw "Command failed with exit code ${exitCode}: $FilePath $($ArgumentList -join ' ')"
  }
}

function Invoke-LoggedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [Parameter(Mandatory = $true)]
    [string[]]$ArgumentList,
    [Parameter(Mandatory = $true)]
    [string]$LogPath
  )

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & $FilePath @ArgumentList *> $LogPath
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    throw "Command failed with exit code ${exitCode}. See log: $LogPath"
  }
}

function Invoke-SupabaseCommand {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Cli,
    [Parameter(Mandatory = $true)]
    [string[]]$ArgumentList
  )

  Invoke-ExternalCommand $Cli.FilePath ($Cli.PrefixArgs + $ArgumentList)
}

function Invoke-SupabaseLoggedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Cli,
    [Parameter(Mandatory = $true)]
    [string[]]$ArgumentList,
    [Parameter(Mandatory = $true)]
    [string]$LogPath
  )

  Invoke-LoggedCommand $Cli.FilePath ($Cli.PrefixArgs + $ArgumentList) $LogPath
}

function Get-SupabaseOutput {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Cli,
    [Parameter(Mandatory = $true)]
    [string[]]$ArgumentList
  )

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = & $Cli.FilePath @($Cli.PrefixArgs + $ArgumentList)
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return @{
    ExitCode = $exitCode
    Output = @($output)
  }
}

function Start-SupabaseIfNeeded {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Cli,
    [Parameter(Mandatory = $true)]
    [string]$LogPath,
    [Parameter(Mandatory = $true)]
    [string]$Excludes
  )

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & $Cli.FilePath @($Cli.PrefixArgs + @("start", "-x", $Excludes, "--yes")) *> $LogPath
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -eq 0) {
    return
  }

  $logContent = if (Test-Path $LogPath) {
    Get-Content $LogPath -Raw
  } else {
    ""
  }

  if ($logContent -match "supabase start is already running") {
    return
  }

  throw "Command failed with exit code ${exitCode}. See log: $LogPath"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed on Windows PATH."
}

$supabaseCli = Resolve-SupabaseCli

$tempDir = if ($env:TEMP -and $env:TEMP.Trim().Length -gt 0) {
  $env:TEMP
} else {
  [System.IO.Path]::GetTempPath().TrimEnd('\')
}

$supabaseStartLog = Join-Path $tempDir "supabase_start_payment_callback_smoke.log"
$supabaseDbResetLog = Join-Path $tempDir "supabase_db_reset_payment_callback_smoke.log"
$excludes = "realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,mailpit"

Start-SupabaseIfNeeded $supabaseCli $supabaseStartLog $excludes
Invoke-SupabaseLoggedCommand $supabaseCli @("db", "reset") $supabaseDbResetLog

$statusResult = Get-SupabaseOutput $supabaseCli @("status", "-o", "env")
$statusEnv = if ($statusResult.ExitCode -eq 0) { $statusResult.Output } else { @() }

foreach ($line in $statusEnv) {
  if ($line -match "^[A-Z0-9_]+=") {
    $separatorIndex = $line.IndexOf("=")
    $key = $line.Substring(0, $separatorIndex)
    $value = $line.Substring($separatorIndex + 1).Trim('"')
    [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
  }
}

$configApiUrl = Get-SupabaseApiUrlFromConfig
if (-not $env:API_URL -and $configApiUrl) {
  $env:API_URL = $configApiUrl
}
if (-not $env:ANON_KEY) {
  $env:ANON_KEY = $defaultSupabaseAnonKey
}
if (-not $env:SERVICE_ROLE_KEY) {
  $env:SERVICE_ROLE_KEY = $defaultSupabaseServiceRoleKey
}

$publishableKey = if ($env:PUBLISHABLE_KEY) { $env:PUBLISHABLE_KEY } else { $env:ANON_KEY }
if (-not $env:API_URL -or -not $publishableKey -or -not $env:SERVICE_ROLE_KEY) {
  throw "Supabase env values are missing (API_URL/PUBLISHABLE_KEY or ANON_KEY/SERVICE_ROLE_KEY)."
}

$env:NEXT_PUBLIC_SUPABASE_URL = $env:API_URL
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $publishableKey
$env:SUPABASE_SERVICE_ROLE_KEY = $env:SERVICE_ROLE_KEY
if (-not $env:ISBANK_STORE_KEY) {
  $env:ISBANK_STORE_KEY = "SMOKE_TEST_ISBANK_STORE_KEY"
}
if (-not $env:ISBANK_CLIENT_ID) {
  $env:ISBANK_CLIENT_ID = "7000679"
}

Wait-ForSupabaseApi $env:NEXT_PUBLIC_SUPABASE_URL

Invoke-ExternalCommand "node" @(
  "--experimental-strip-types",
  "--experimental-specifier-resolution=node",
  "--test",
  "tests/payment-callback-smoke.test.mts"
)
