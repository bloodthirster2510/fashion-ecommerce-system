param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$PublicBaseUrl,

  [string]$EnvPath
)

$resolvedEnvPath = if ($EnvPath) {
  $EnvPath
} else {
  Join-Path $PSScriptRoot '..\.env'
}
$normalizedBaseUrl = $PublicBaseUrl.Trim().TrimEnd('/')

if ($normalizedBaseUrl -notmatch '^https?://') {
  throw "PublicBaseUrl must start with http:// or https://"
}

if (-not (Test-Path $resolvedEnvPath)) {
  throw "Env file not found: $resolvedEnvPath"
}

$updates = [ordered]@{
  VNPAY_PUBLIC_BASE_URL = $normalizedBaseUrl
  VNPAY_RETURN_URL = "$normalizedBaseUrl/api/payments/vnpay/return"
  VNPAY_IPN_URL = "$normalizedBaseUrl/api/payments/vnpay/ipn"
  VNPAY_MOBILE_RETURN_URL = "fashion-ecommerce://payment-return"
}

$lines = [System.Collections.Generic.List[string]]::new()
(Get-Content -Path $resolvedEnvPath -Encoding UTF8) | ForEach-Object {
  $lines.Add($_)
}

foreach ($key in $updates.Keys) {
  $value = $updates[$key]
  $updated = $false

  for ($i = 0; $i -lt $lines.Count; $i += 1) {
    if ($lines[$i] -match "^$([regex]::Escape($key))=") {
      $lines[$i] = "$key=$value"
      $updated = $true
      break
    }
  }

  if (-not $updated) {
    $lines.Add("$key=$value")
  }
}

Set-Content -Path $resolvedEnvPath -Encoding UTF8 -Value $lines

Write-Output "Updated VNPay public callbacks:"
Write-Output "  VNPAY_PUBLIC_BASE_URL=$normalizedBaseUrl"
Write-Output "  VNPAY_RETURN_URL=$($updates.VNPAY_RETURN_URL)"
Write-Output "  VNPAY_IPN_URL=$($updates.VNPAY_IPN_URL)"
Write-Output "Restart backend, then create a new VNPay payment URL."
