param(
  [switch]$Android,
  [switch]$KeepCache,
  [switch]$ResetExpoGo
)

$ANDROID_HOME = "C:\Users\granji\AppData\Local\Android\Sdk"
$JAVA_HOME = "C:\Program Files\Java\jdk-17"
$API_PORT = "5000"
$AVD_NAME = "Pixel_6"

$env:ANDROID_HOME = $ANDROID_HOME
$env:JAVA_HOME = $JAVA_HOME
$env:PATH = "$JAVA_HOME\bin;$env:PATH"
$ADB = "$ANDROID_HOME\platform-tools\adb.exe"
$EMULATOR = "$ANDROID_HOME\emulator\emulator.exe"

Set-Location $PSScriptRoot

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
  Set-Content -Path "$PSScriptRoot\.env" -Encoding ASCII -Value @(
    "EXPO_PUBLIC_API_HOST=$DEV_API_HOST",
    "EXPO_PUBLIC_API_PORT=$API_PORT"
  )
  Write-Output "[env] EXPO_PUBLIC_API_HOST=$DEV_API_HOST"
} else {
  Write-Output "[env] Could not detect LAN IP. Keeping existing mobile/.env."
}

Write-Output "[0] Stop old Metro server on port 8081..."
Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }

if ($Android) {
  Write-Output "[1] Emulator..."
  Get-Process emulator,qemu-system-x86_64 -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
  & $ADB kill-server | Out-Null
  & $ADB start-server | Out-Null
  Start-Process $EMULATOR -ArgumentList "-avd", $AVD_NAME, "-no-snapshot-load"
} else {
  Write-Output "[1] Skip emulator. Use Expo QR, or run .\dev.ps1 -Android for $AVD_NAME."
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

if ($Android) {
  Write-Output "[3.5] Wait for Android device..."
  $androidReady = (Wait-AndroidDevice -TimeoutSeconds 90) -and (Wait-AndroidBoot -TimeoutSeconds 90)
  if ($androidReady) {
    & $ADB reverse tcp:$API_PORT tcp:$API_PORT | Out-Null
    & $ADB reverse tcp:8081 tcp:8081 | Out-Null
    Write-Output "ADB reverse configured: localhost:$API_PORT -> computer, localhost:8081 -> computer"
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

$expoArgs = @("expo", "start", "--lan", "--port", "8081")
if (-not $KeepCache) {
  $expoArgs += "--clear"
}

if ($Android -and $androidReady) {
  $expoUrl = "exp://127.0.0.1:8081"
  $openAndroidCommand = @"
`$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt `$deadline) {
  try {
    `$response = Invoke-WebRequest -UseBasicParsing "http://localhost:8081/status" -TimeoutSec 2
    if (`$response.StatusCode -eq 200) {
      & "$ADB" shell am start -a android.intent.action.VIEW -d "$expoUrl" host.exp.exponent | Out-Null
      exit 0
    }
  } catch {}

  Start-Sleep -Seconds 1
}
"@
  Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $openAndroidCommand
  Write-Output "Expo will open on Android via ADB: $expoUrl"
}

Write-Output "[4] Start Expo dev server..."
& npx.cmd @expoArgs
