# Temporary debugging script.
# Probes remote endpoints and prints HTTP status + body snippet.
param(
  [string]$BaseUrl = "https://luccibyey.com.tn/remquip/backend/api.php",
  [string]$Token = ""
)

function Invoke-ApiPath {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][string]$Path,
    [hashtable]$Query = @{}
  )

  $pathEnc = [Uri]::EscapeDataString($Path)
  $url = "$BaseUrl?path=$pathEnc"

  foreach ($k in $Query.Keys) {
    $v = $Query[$k]
    $url += "&$k=$([Uri]::EscapeDataString([string]$v))"
  }

  if ($Token -and $Token.Trim().Length -gt 0) {
    $url += "&token=$([Uri]::EscapeDataString($Token))"
  }

  Write-Host "---- $Name ----"
  Write-Host ("BaseUrlLen=" + $BaseUrl.Length)
  Write-Host ("UrlLen=" + $url.Length)
  Write-Host ("UrlStartsWithHttp=" + $url.StartsWith("http"))
  $prefixLen = [Math]::Min(40, $url.Length)
  Write-Host ("UrlPrefix=" + $url.Substring(0, $prefixLen))

  try {
    $r = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
    Write-Host ("STATUS " + $r.StatusCode)
    $body = $r.Content
    if ($null -eq $body) { $body = "" }
    if ($body.Length -gt 600) { $body = $body.Substring(0,600) }
    Write-Host $body
  }
  catch {
    $resp = $_.Exception.Response
    if ($resp -ne $null) {
      $status = $resp.StatusCode.value__
      Write-Host ("STATUS " + $status)
      try {
        $sr = New-Object IO.StreamReader($resp.GetResponseStream())
        $body = $sr.ReadToEnd()
        if ($null -eq $body) { $body = "" }
        if ($body.Length -gt 600) { $body = $body.Substring(0,600) }
        Write-Host $body
      } catch {
        Write-Host ("BODY_READ_ERROR: " + $_.Exception.Message)
      }
    } else {
      Write-Host ("ERROR: " + $_.Exception.Message)
    }
  }
}

$tokenVal = $Token

Invoke-ApiPath -Name "products (page=1 limit=50)" -Path "products" -Query @{ page = 1; limit = 50 }
Invoke-ApiPath -Name "inventory low-stock" -Path "inventory/low-stock" -Query @{}
Invoke-ApiPath -Name "dashboard stats" -Path "dashboard/stats" -Query @{}
Invoke-ApiPath -Name "analytics dashboard" -Path "analytics/dashboard" -Query @{}

