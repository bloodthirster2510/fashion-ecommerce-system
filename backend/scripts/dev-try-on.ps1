param(
  [switch]$SkipInstall,
  [switch]$DryRun,
  [switch]$NoBackend,
  [switch]$NoImageValidation,
  [switch]$NoGarmentProcessing,
  [switch]$RestartExisting,
  [int]$SmokeTestSeconds = 0
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$pythonVenvRoot = Join-Path ([System.IO.Path]::GetPathRoot($root)) 'fes-venvs'

function Test-TcpPort {
  param([int]$Port)

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connect = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $connect.AsyncWaitHandle.WaitOne(500)) {
      return $false
    }
    $client.EndConnect($connect)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Stop-ProcessOnPort {
  param(
    [int]$Port,
    [string]$ServiceName
  )

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  $processIds = @($connections | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -and $_ -gt 0 })
  if ($processIds.Count -eq 0) {
    return
  }

  foreach ($processId in $processIds) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    $processName = if ($process) { $process.ProcessName } else { "pid $processId" }
    if ($DryRun) {
      Write-Host "[dry-run] Stop $ServiceName on port $Port ($processName, pid $processId)"
      continue
    }

    Write-Host "[$ServiceName] Stopping existing process on port $Port ($processName, pid $processId)..."
    Stop-Process -Id $processId -Force -ErrorAction Stop
  }

  Start-Sleep -Milliseconds 500
}

function Ensure-PythonService {
  param(
    [string]$ServiceName,
    [string]$ServicePath
  )

  $venvName = switch ($ServiceName) {
    'image-validation' { 'iv' }
    'garment-processing' { 'gp' }
    default { $ServiceName }
  }
  $venvPath = Join-Path $pythonVenvRoot $venvName
  $venvPython = Join-Path $venvPath 'Scripts\python.exe'
  if ($DryRun) {
    Write-Host "[dry-run] Ensure $ServiceName venv at $venvPath"
    return $venvPython
  }

  Push-Location $ServicePath
  try {
    if (-not (Test-Path -LiteralPath $venvPython)) {
      Write-Host "[$ServiceName] Creating Python venv at $venvPath..."
      New-Item -ItemType Directory -Force -Path $pythonVenvRoot | Out-Null
      python -m venv $venvPath 2>&1 | ForEach-Object {
        Write-Host "[$ServiceName] $_"
      }
      if ($LASTEXITCODE -ne 0) {
        throw "[$ServiceName] Failed to create Python venv."
      }
    }

    if (-not $SkipInstall) {
      Write-Host "[$ServiceName] Installing Python requirements..."
      & $venvPython -m pip install --disable-pip-version-check -r requirements.txt 2>&1 | ForEach-Object {
        Write-Host "[$ServiceName] $_"
      }
      if ($LASTEXITCODE -ne 0) {
        throw "[$ServiceName] Failed to install Python requirements."
      }
    }
  } finally {
    Pop-Location
  }

  return $venvPython
}

function Start-DevJob {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$Executable,
    [string[]]$Arguments,
    [hashtable]$Environment = @{}
  )

  if ($DryRun) {
    Write-Host "[dry-run] $Name"
    Write-Host "  cd $WorkingDirectory"
    Write-Host "  $Executable $($Arguments -join ' ')"
    foreach ($key in $Environment.Keys) {
      Write-Host "  env:$key=$($Environment[$key])"
    }
    return $null
  }

  Start-Job -Name $Name -ScriptBlock {
    param($WorkingDirectory, $Executable, $Arguments, $Environment)

    $ErrorActionPreference = 'Stop'
    Set-Location $WorkingDirectory
    foreach ($key in $Environment.Keys) {
      [Environment]::SetEnvironmentVariable($key, [string]$Environment[$key], 'Process')
    }
    $ErrorActionPreference = 'Continue'
    if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
      $PSNativeCommandUseErrorActionPreference = $false
    }
    & $Executable @Arguments 2>&1 | ForEach-Object {
      Write-Output $_
    }
    if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) {
      throw "$Executable exited with code $LASTEXITCODE"
    }
  } -ArgumentList $WorkingDirectory, $Executable, $Arguments, $Environment
}

function Receive-DevJobOutput {
  param([System.Management.Automation.Job]$Job)

  $receiveErrors = @()
  Receive-Job -Job $Job -ErrorAction SilentlyContinue -ErrorVariable receiveErrors | ForEach-Object {
    Write-Host "[$($Job.Name)] $_"
  }
  foreach ($errorRecord in $receiveErrors) {
    Write-Host "[$($Job.Name)] $errorRecord"
  }
}

$jobs = @()

if (-not $NoImageValidation) {
  $imageValidationPath = Join-Path $root 'ai_services\image-validation'
  if (Test-TcpPort 7001) {
    if ($RestartExisting) {
      Stop-ProcessOnPort 7001 'image-validation'
    } else {
      Write-Host '[image-validation] Port 7001 is already in use; leaving existing service alone. Use -RestartExisting to reload it.'
    }
  }
  if (-not (Test-TcpPort 7001)) {
    $imageValidationPython = Ensure-PythonService 'image-validation' $imageValidationPath
    $job = Start-DevJob `
      -Name 'image-validation:7001' `
      -WorkingDirectory $imageValidationPath `
      -Executable $imageValidationPython `
      -Arguments @('-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '7001')
    if ($job) { $jobs += $job }
  }
}

if (-not $NoGarmentProcessing) {
  $garmentProcessingPath = Join-Path $root 'ai_services\garment-processing'
  if (Test-TcpPort 7002) {
    if ($RestartExisting) {
      Stop-ProcessOnPort 7002 'garment-processing'
    } else {
      Write-Host '[garment-processing] Port 7002 is already in use; leaving existing service alone. Use -RestartExisting to reload it.'
    }
  }
  if (-not (Test-TcpPort 7002)) {
    $garmentProcessingPython = Ensure-PythonService 'garment-processing' $garmentProcessingPath
    if (-not $SkipInstall) {
      Write-Host '[garment-processing] Ensuring model files are available...'
      if ($DryRun) {
        Write-Host "[dry-run] $garmentProcessingPython $((Join-Path $garmentProcessingPath 'scripts\download_models.py'))"
      } else {
        & $garmentProcessingPython (Join-Path $garmentProcessingPath 'scripts\download_models.py') 2>&1 | ForEach-Object {
          Write-Host "[garment-processing] $_"
        }
        if ($LASTEXITCODE -ne 0) {
          throw '[garment-processing] Failed to download model files.'
        }
      }
    }
    $job = Start-DevJob `
      -Name 'garment-processing:7002' `
      -WorkingDirectory $garmentProcessingPath `
      -Executable $garmentProcessingPython `
      -Arguments @('-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '7002')
    if ($job) { $jobs += $job }
  }
}

if (-not $NoBackend) {
  $backendPath = Join-Path $root 'backend'
  if (Test-TcpPort 5000) {
    if ($RestartExisting) {
      Stop-ProcessOnPort 5000 'backend'
    } else {
      Write-Host '[backend] Port 5000 is already in use; leaving existing backend alone. Use -RestartExisting to reload it.'
    }
  }
  if (-not (Test-TcpPort 5000)) {
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    $npm = if ($npmCommand) { $npmCommand.Source } else { $null }
    if (-not $npm) { $npm = 'npm' }

    $backendEnv = @{}
    if (-not $NoImageValidation) {
      $backendEnv['IMAGE_VALIDATION_PROVIDER'] = 'custom_model'
      $backendEnv['IMAGE_VALIDATION_CUSTOM_MODEL_URL'] = 'http://127.0.0.1:7001/validate-image'
      $backendEnv['IMAGE_VALIDATION_FAIL_OPEN'] = 'false'
    }
    if (-not $NoGarmentProcessing) {
      $backendEnv['VIRTUAL_TRY_ON_GARMENT_PROCESSING_URL'] = 'http://127.0.0.1:7002/prepare-collage'
    }

    $job = Start-DevJob `
      -Name 'backend:5000' `
      -WorkingDirectory $backendPath `
      -Executable $npm `
      -Arguments @('run', 'dev') `
      -Environment $backendEnv
    if ($job) { $jobs += $job }
  }
}

if ($DryRun) {
  exit 0
}

if ($jobs.Count -eq 0) {
  Write-Host 'No new jobs were started.'
  exit 0
}

Write-Host 'Try-on dev stack is starting. Press Ctrl+C to stop jobs started by this script.'
$smokeTestDeadline = if ($SmokeTestSeconds -gt 0) { (Get-Date).AddSeconds($SmokeTestSeconds) } else { $null }

try {
  while ($true) {
    foreach ($job in $jobs) {
      Receive-DevJobOutput -Job $job
    }

    $finished = $jobs | Where-Object { $_.State -ne 'Running' }
    if ($finished) {
      foreach ($job in $finished) {
        Receive-DevJobOutput -Job $job
        Write-Host "[$($job.Name)] exited with state $($job.State)"
      }
      throw 'One or more dev jobs exited.'
    }

    if ($smokeTestDeadline -and (Get-Date) -ge $smokeTestDeadline) {
      Write-Host "Smoke test completed after $SmokeTestSeconds seconds."
      break
    }

    Start-Sleep -Seconds 1
  }
} finally {
  foreach ($job in $jobs) {
    if ($job.State -eq 'Running') {
      Stop-Job -Job $job
    }
    Remove-Job -Job $job -Force
  }
}
