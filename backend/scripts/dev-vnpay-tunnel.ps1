param(
  [string]$CloudflaredPath
)

$ErrorActionPreference = 'Stop'

$backendDir = Resolve-Path (Join-Path $PSScriptRoot '..')
$repoDir = Resolve-Path (Join-Path $backendDir '..')
$mobileEnvPath = Join-Path $repoDir 'mobile\.env'
$defaultCloudflaredPath = Join-Path $repoDir 'tools\cloudflared.exe'
$cloudflared = if ($CloudflaredPath) { $CloudflaredPath } else { $defaultCloudflaredPath }

function Set-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$EnvPath,

    [Parameter(Mandatory = $true)]
    [string]$Key,

    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  $lines = [System.Collections.Generic.List[string]]::new()
  if (Test-Path $EnvPath) {
    (Get-Content -Path $EnvPath -Encoding UTF8) | ForEach-Object {
      $lines.Add($_)
    }
  }

  $updated = $false
  for ($i = 0; $i -lt $lines.Count; $i += 1) {
    if ($lines[$i] -match "^$([regex]::Escape($Key))=") {
      $lines[$i] = "$Key=$Value"
      $updated = $true
      break
    }
  }

  if (-not $updated) {
    $lines.Add("$Key=$Value")
  }

  Set-Content -Path $EnvPath -Encoding UTF8 -Value $lines
}

if (-not (Test-Path $cloudflared)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $cloudflared) | Out-Null
  Write-Output "Downloading cloudflared..."
  Invoke-WebRequest `
    -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' `
    -OutFile $cloudflared
}

$stdoutLog = Join-Path $env:TEMP "fashion-cloudflared-$PID.out.log"
$stderrLog = Join-Path $env:TEMP "fashion-cloudflared-$PID.err.log"

Write-Output "Starting Cloudflare tunnel for http://localhost:5000..."
$tunnelProcess = Start-Process `
  -FilePath $cloudflared `
  -ArgumentList @('tunnel', '--url', 'http://localhost:5000') `
  -NoNewWindow `
  -PassThru `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog

try {
  $publicUrl = $null
  $deadline = (Get-Date).AddSeconds(60)

  while ((Get-Date) -lt $deadline -and -not $publicUrl) {
    Start-Sleep -Milliseconds 500

    $logs = @()
    if (Test-Path $stdoutLog) {
      $logs += Get-Content $stdoutLog -Raw
    }
    if (Test-Path $stderrLog) {
      $logs += Get-Content $stderrLog -Raw
    }

    $match = ($logs -join "`n") | Select-String -Pattern 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' -AllMatches
    if ($match.Matches.Count -gt 0) {
      $publicUrl = $match.Matches[0].Value
    }

    if ($tunnelProcess.HasExited) {
      throw 'cloudflared exited before a public URL was created.'
    }
  }

  if (-not $publicUrl) {
    throw 'Timed out waiting for Cloudflare tunnel URL.'
  }

  Write-Output "Tunnel URL: $publicUrl"
  & (Join-Path $PSScriptRoot 'set-vnpay-public-url.ps1') $publicUrl
  Set-EnvValue -EnvPath $mobileEnvPath -Key 'EXPO_PUBLIC_API_URL' -Value "$publicUrl/api"
  Write-Output "Updated mobile API URL:"
  Write-Output "  EXPO_PUBLIC_API_URL=$publicUrl/api"

  Write-Output ''
  Write-Output 'Starting backend dev server. Keep this terminal open.'
  Write-Output 'Press Ctrl+C to stop backend and tunnel.'
  Push-Location $backendDir
  try {
    npm.cmd run dev
  } finally {
    Pop-Location
  }
} finally {
  if ($tunnelProcess -and -not $tunnelProcess.HasExited) {
    Stop-Process -Id $tunnelProcess.Id -Force
  }
}
