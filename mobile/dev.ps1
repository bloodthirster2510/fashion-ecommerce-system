param(
  [switch]$Android,
  [switch]$NoAndroid,
  [switch]$KeepCache,
  [switch]$ResetExpoGo,
  [switch]$RestartEmulator,
  [switch]$UseSnapshot,
  [switch]$Tunnel,
  [int]$BootTimeoutSeconds = 180,
  [string]$AvdName = "Pixel_6"
)

$API_PORT = "5000"
$UseAndroid = -not $NoAndroid

function Resolve-AndroidSdkPath {
  $candidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    (Join-Path $env:LOCALAPPDATA "Android\Sdk")
  ) | Where-Object { $_ -and (Test-Path $_) }

  foreach ($candidate in $candidates) {
    if (Test-Path (Join-Path $candidate "platform-tools\adb.exe")) {
      return $candidate
    }
  }

  throw "Android SDK not found. Set ANDROID_HOME or install Android Studio SDK."
}

function Resolve-JavaHomePath {
  if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
    return $env:JAVA_HOME
  }

  $javaRoot = "C:\Program Files\Java"
  if (Test-Path $javaRoot) {
    $candidate = Get-ChildItem $javaRoot -Directory |
      Where-Object { Test-Path (Join-Path $_.FullName "bin\java.exe") } |
      Sort-Object Name -Descending |
      Select-Object -First 1

    if ($candidate) {
      return $candidate.FullName
    }
  }

  return $null
}

$ANDROID_HOME = Resolve-AndroidSdkPath
$JAVA_HOME = Resolve-JavaHomePath

$env:ANDROID_HOME = $ANDROID_HOME
$env:ANDROID_SDK_ROOT = $ANDROID_HOME
if ($JAVA_HOME) {
  $env:JAVA_HOME = $JAVA_HOME
}

$androidTools = @(
  (Join-Path $ANDROID_HOME "platform-tools"),
  (Join-Path $ANDROID_HOME "emulator")
)
$javaTools = if ($JAVA_HOME) { @((Join-Path $JAVA_HOME "bin")) } else { @() }
$env:PATH = (($javaTools + $androidTools + @($env:PATH)) -join ";")

$ADB = Join-Path $ANDROID_HOME "platform-tools\adb.exe"
$EMULATOR = Join-Path $ANDROID_HOME "emulator\emulator.exe"

Set-Location $PSScriptRoot

function Set-MobileEnvValue {
  param(
    [string]$Key,
    [string]$Value
  )

  $envPath = Join-Path $PSScriptRoot ".env"
  $lines = [System.Collections.Generic.List[string]]::new()
  if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object { [void]$lines.Add($_) }
  }
  $updated = $false

  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*$([regex]::Escape($Key))=") {
      $lines[$i] = "$Key=$Value"
      $updated = $true
      break
    }
  }

  if (-not $updated) {
    $lines.Add("$Key=$Value")
  }

  Set-Content -Path $envPath -Encoding ASCII -Value $lines
}

function Test-AndroidDeviceReady {
  try {
    $devices = & $ADB devices
    return $devices -match "`tdevice"
  } catch {
    return $false
  }
}

function Test-ExpoGoInstalled {
  try {
    $package = (& $ADB shell pm list packages host.exp.exponent 2>$null).Trim()
    return $package -eq "package:host.exp.exponent"
  } catch {
    return $false
  }
}

function Resolve-AvdName {
  param(
    [string]$RequestedName,
    [string[]]$AvailableAvds
  )

  if ($AvailableAvds -contains $RequestedName) {
    return $RequestedName
  }

  $normalizedRequested = $RequestedName -replace "[\s_-]+", ""
  $matchingAvd = $AvailableAvds |
    Where-Object { ($_ -replace "[\s_-]+", "") -ieq $normalizedRequested } |
    Select-Object -First 1

  if (-not $matchingAvd) {
    $matchingAvd = $AvailableAvds |
      Where-Object { ($_ -replace "[\s_-]+", "").StartsWith($normalizedRequested, [System.StringComparison]::OrdinalIgnoreCase) } |
      Select-Object -First 1
  }

  if ($matchingAvd) {
    return $matchingAvd
  }

  return $null
}

function Stop-AndroidEmulators {
  try {
    $devices = & $ADB devices |
      Where-Object { $_ -match "^emulator-\d+\s+" } |
      ForEach-Object { ($_ -split "\s+")[0] }

    foreach ($device in $devices) {
      & $ADB -s $device emu kill | Out-Null
    }
  } catch {}

  Get-Process qemu-system-x86_64 -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
}

function Get-DevApiHost {
  $interfaces = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
    Where-Object {
      $_.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up -and
      $_.NetworkInterfaceType -ne [System.Net.NetworkInformation.NetworkInterfaceType]::Loopback -and
      $_.NetworkInterfaceType -ne [System.Net.NetworkInformation.NetworkInterfaceType]::Tunnel
    }

  foreach ($interface in $interfaces) {
    $properties = $interface.GetIPProperties()
    if ($properties.GatewayAddresses.Count -eq 0) {
      continue
    }

    foreach ($address in $properties.UnicastAddresses) {
      if (
        $address.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
        $address.Address.IPAddressToString -notlike "169.254*" -and
        $address.Address.IPAddressToString -notlike "127.*"
      ) {
        return $address.Address.IPAddressToString
      }
    }
  }

  return $null
}

function Test-BackendHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing "http://localhost:$API_PORT/health" -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Wait-AndroidDevice {
  param([int]$TimeoutSeconds = 90)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $devices = & $ADB devices
    if ($devices -match "`tdevice") {
      return $true
    }

    Start-Sleep -Seconds 2
  }

  return $false
}

function Wait-AndroidBoot {
  param([int]$TimeoutSeconds = 90)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $bootCompleted = (& $ADB shell getprop sys.boot_completed 2>$null).Trim()
      if ($bootCompleted -eq "1") {
        return $true
      }
    } catch {}

    Start-Sleep -Seconds 2
  }

  return $false
}

$DEV_API_HOST = Get-DevApiHost
if ($DEV_API_HOST) {
  $env:EXPO_PUBLIC_API_HOST = $DEV_API_HOST
  $env:EXPO_PUBLIC_API_PORT = $API_PORT
  $env:EXPO_PUBLIC_API_URL = "http://$DEV_API_HOST`:$API_PORT/api"
  Set-MobileEnvValue -Key "EXPO_PUBLIC_API_HOST" -Value $DEV_API_HOST
  Set-MobileEnvValue -Key "EXPO_PUBLIC_API_PORT" -Value $API_PORT
  Set-MobileEnvValue -Key "EXPO_PUBLIC_API_URL" -Value $env:EXPO_PUBLIC_API_URL
  Write-Output "[env] EXPO_PUBLIC_API_HOST=$DEV_API_HOST"
  Write-Output "[env] EXPO_PUBLIC_API_URL=$env:EXPO_PUBLIC_API_URL"
} else {
  Write-Output "[env] Could not detect LAN IP. Keeping existing mobile/.env."
}

Write-Output "[0] Stop old Metro server on port 8081..."
Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }

if ($UseAndroid) {
  Write-Output "[1] Emulator..."
  & $ADB kill-server | Out-Null
  & $ADB start-server | Out-Null

  if ($RestartEmulator) {
    Write-Output "Restarting Android emulator..."
    Stop-AndroidEmulators
    Start-Sleep -Seconds 3
  }

  if (Test-AndroidDeviceReady) {
    Write-Output "Android device already connected. Reusing it."
  } else {
    $availableAvds = & $EMULATOR -list-avds
    $resolvedAvdName = Resolve-AvdName -RequestedName $AvdName -AvailableAvds $availableAvds
    if (-not $resolvedAvdName) {
      Write-Output "AVD '$AvdName' not found. Available AVDs:"
      $availableAvds | ForEach-Object { Write-Output " - $_" }
      throw "Create the AVD or pass -AvdName with an existing name."
    }

    $emulatorArgs = @("-avd", $resolvedAvdName, "-netdelay", "none", "-netspeed", "full")
    if (-not $UseSnapshot) {
      $emulatorArgs += "-no-snapshot-load"
    }

    Write-Output "Starting Android emulator: $resolvedAvdName"
    Start-Process $EMULATOR -ArgumentList $emulatorArgs
  }
} else {
  Write-Output "[1] Skip emulator. Use Expo QR/LAN mode."
}

if (Test-BackendHealth) {
  Write-Output "[2] Backend already running."
} else {
  Write-Output "[2] Backend..."
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$PSScriptRoot\..\backend`"; npm.cmd run dev" -WindowStyle Minimized
}

Write-Output "[3] Wait for backend health..."
$backendReady = $false
for ($i = 0; $i -lt 15; $i++) {
  if (Test-BackendHealth) {
    $backendReady = $true
    break
  }

  Start-Sleep -Seconds 1
}

if ($backendReady) {
  Write-Output "Backend is ready."
} else {
  Write-Output "Backend is not ready yet; continuing to Expo."
}

if ($UseAndroid) {
  Write-Output "[3.5] Wait for Android device..."
  $androidReady = (Wait-AndroidDevice -TimeoutSeconds $BootTimeoutSeconds) -and (Wait-AndroidBoot -TimeoutSeconds $BootTimeoutSeconds)
  if ($androidReady) {
    & $ADB reverse tcp:$API_PORT tcp:$API_PORT | Out-Null
    & $ADB reverse tcp:8081 tcp:8081 | Out-Null
    Write-Output "ADB reverse configured: localhost:$API_PORT -> computer, localhost:8081 -> computer"
    if (Test-ExpoGoInstalled) {
      Write-Output "Expo Go is installed on Android."
    } else {
      Write-Output "Expo Go is not installed on Android. Expo CLI may prompt to install it."
    }
    if ($ResetExpoGo) {
      & $ADB shell pm clear host.exp.exponent | Out-Null
      Write-Output "Expo Go app data cleared."
    } else {
      & $ADB shell am force-stop host.exp.exponent | Out-Null
    }
  } else {
    Write-Output "Android device is not ready; continuing with Expo QR/LAN only."
  }
} else {
  Write-Output "[3.5] Skip Android reverse."
  $androidReady = $false
}

if ($DEV_API_HOST) {
  $env:EXPO_PUBLIC_API_HOST = $DEV_API_HOST
  $env:EXPO_PUBLIC_API_PORT = $API_PORT
  $env:EXPO_PUBLIC_API_URL = "http://$DEV_API_HOST`:$API_PORT/api"
  Set-MobileEnvValue -Key "EXPO_PUBLIC_API_HOST" -Value $DEV_API_HOST
  Set-MobileEnvValue -Key "EXPO_PUBLIC_API_PORT" -Value $API_PORT
  Set-MobileEnvValue -Key "EXPO_PUBLIC_API_URL" -Value $env:EXPO_PUBLIC_API_URL
  Write-Output "[env] Final EXPO_PUBLIC_API_URL=$env:EXPO_PUBLIC_API_URL"
}

$expoArgs = @("expo", "start", "--go", "--port", "8081")
if ($UseAndroid -and $androidReady) {
  if ($Tunnel) {
    $expoArgs += "--tunnel"
  } else {
    $expoArgs += "--localhost"
  }
  $expoArgs += "--android"
} elseif ($Tunnel) {
  $expoArgs += "--tunnel"
} else {
  $expoArgs += "--lan"
}

if (-not $KeepCache) {
  $expoArgs += "--clear"
}

Write-Output "[4] Start Expo dev server..."
& npx.cmd @expoArgs
