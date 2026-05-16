$ErrorActionPreference = "Stop"

$base = "https://luccibyey.com.tn/remquip/backend"

Write-Host "Logging in as admin..."
$loginUrl = "$base/api.php?path=auth%2Flogin"
$bodyObj = @{
  email = "admin@remquip.local"
  password = "password"
}
$bodyJson = ($bodyObj | ConvertTo-Json -Compress)
$resp = Invoke-RestMethod -Method Post -Uri $loginUrl -ContentType "application/json" -Body $bodyJson
$token = $resp.data.token
if ([string]::IsNullOrWhiteSpace($token)) {
  throw "Token empty. Login response: $($resp | ConvertTo-Json -Depth 6)"
}

Write-Host ("Token prefix: " + $token.Substring(0,10))
Write-Host ("Token length: " + $token.Length)

$headers = @{
  Authorization = "Bearer $token"
  "X-Auth-Token" = $token
}

function Test-Get([string]$path) {
  # $path is logical path without leading slash (may include ?page=...).
  $parts = $path.Split('?', 2)
  $pathOnly = $parts[0]
  $qs = if ($parts.Count -gt 1) { $parts[1] } else { "" }

  $tokenEnc = [uri]::EscapeDataString($token)
  $pathEnc = [uri]::EscapeDataString($pathOnly)
  $url = "$base/api.php?path=$pathEnc&token=$tokenEnc"
  if ($qs -ne "") {
    $url = $url + "&" + $qs
  }
  try {
    $r = Invoke-RestMethod -Method Get -Uri $url -Headers $headers
    Write-Host ("OK  " + $path)
  } catch {
    $status = 0
    $bodyText = ""
    try {
      $status = $_.Exception.Response.StatusCode.value__
    } catch { }
    try {
      $resp = $_.Exception.Response
      $stream = $resp.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $bodyText = $reader.ReadToEnd()
    } catch { }
    Write-Host ("FAIL " + $path + " status=" + $status)
    if ($bodyText -ne "") {
      Write-Host ("  BODY=" + $bodyText.Substring(0, [Math]::Min(600, $bodyText.Length)))
    }
  }
}

Write-Host "==== Protected admin read endpoints ===="

$adminReadPaths = @(
  "dashboard/stats",
  "dashboard/recent-orders",
  "dashboard/activity-log",
  "dashboard/top-products",
  "inventory/low-stock",
  "inventory/logs?page=1&limit=20",
  "orders?page=1&limit=5",
  "customers?page=1&limit=5",
  "discounts?page=1&limit=5",
  "analytics/dashboard",
  "analytics/events/summary?days=30",
  "settings",
  "users?page=1&limit=10",
  "admin/permissions",
  "cms/pages?page=1&limit=5",
  "cms/pages/home/content?locale=en"
)

foreach ($p in $adminReadPaths) {
  Test-Get $p
}

Write-Host "Done."

