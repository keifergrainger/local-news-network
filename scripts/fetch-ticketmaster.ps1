param(
  [Parameter(Mandatory=$false)][string]$ApiKey = $env:TM_API_KEY,
  [Parameter(Mandatory=$true)][double]$Lat,
  [Parameter(Mandatory=$true)][double]$Lng,
  [double]$RadiusMiles,
  [double]$RadiusMeters,
  [int]$Year = (Get-Date).Year,
  [int]$Month = (Get-Date).Month,
  [string]$Output = "public/events.json"
)

function Convert-ToMiles([double]$Miles, [double]$Meters) {
  if ($Miles -gt 0) { return [Math]::Round($Miles, 2) }
  if ($Meters -gt 0) { return [Math]::Round(($Meters / 1609.344), 2) }
  return 25
}

if (-not $ApiKey) { throw "No API key. Pass -ApiKey or set TM_API_KEY." }

# Compute start & end (UTC ISO8601 WITHOUT milliseconds)
$startUtc = [datetime]::SpecifyKind([datetime]::new($Year, $Month, 1, 0,0,0), [datetimekind]::Utc)
$endMonth = if ($Month -eq 12) { 1 } else { $Month + 1 }
$endYear  = if ($Month -eq 12) { $Year + 1 } else { $Year }
$endUtc   = [datetime]::SpecifyKind([datetime]::new($endYear, $endMonth, 1, 0,0,0), [datetimekind]::Utc)

$startStr = $startUtc.ToString("yyyy-MM-ddTHH:mm:ssZ")
$endStr   = $endUtc.ToString("yyyy-MM-ddTHH:mm:ssZ")

$radius = Convert-ToMiles -Miles $RadiusMiles -Meters $RadiusMeters

# Build URL base
$latlong = ("{0},{1}" -f [string]::Format("{0:0.0000}", $Lat), [string]::Format("{0:0.0000}", $Lng))
$baseUrl = "https://app.ticketmaster.com/discovery/v2/events.json"
$size = 200
$page = 0

Write-Host ("Fetching Ticketmaster events for {0}-{1:00} within {2} miles of {3}..." -f $Year,$Month,$radius,$latlong) -ForegroundColor Cyan

$all = @()
$totalPages = 1
$retries = 0

while ($page -lt $totalPages) {
  $qs = @{
    apikey         = $ApiKey
    latlong        = $latlong
    radius         = $radius
    unit           = "miles"
    startDateTime  = $startStr
    endDateTime    = $endStr
    size           = $size
    page           = $page
    sort           = "date,asc"
  }

  $uri = $baseUrl + "?" + ($qs.GetEnumerator() | ForEach-Object { "$($_.Key)=$([uri]::EscapeDataString([string]$_.Value))" } | Sort-Object | -join "&")

  try {
    $resp = Invoke-WebRequest -Uri $uri -TimeoutSec 30
    $json = $resp.Content | ConvertFrom-Json
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.Value__ -eq 429 -and $retries -lt 5) {
      $retries++
      $delay = [Math]::Pow(2,$retries)
      Write-Host "Rate limited (429). Sleeping $delay sec..." -ForegroundColor Yellow
      Start-Sleep -Seconds $delay
      continue
    }
    throw
  }

  if (-not $json) { break }

  # Page info
  $pg = $json.page
  if ($pg) {
    $totalPages = [int]$pg.totalPages
    if (-not $totalPages -or $totalPages -lt 1) { $totalPages = 1 }
  } else {
    $totalPages = 1
  }

  $events = @()
  if ($json._embedded -and $json._embedded.events) {
    $events = $json._embedded.events
  }

  foreach ($e in $events) {
    $start   = $null; $end = $null
    if ($e.dates -and $e.dates.start) {
      if ($e.dates.start.dateTime) { $start = [string]$e.dates.start.dateTime }
      elseif ($e.dates.start.localDate) { $start = "$($e.dates.start.localDate)T00:00:00" }
      if ($e.dates.end -and $e.dates.end.dateTime) { $end = [string]$e.dates.end.dateTime }
    }

    # Venue flatten
    $venueName = $null; $city = $null; $state = $null; $latv = $null; $lngv = $null
    if ($e._embedded -and $e._embedded.venues -and $e._embedded.venues.Count -gt 0) {
      $v = $e._embedded.venues[0]
      $venueName = $v.name
      if ($v.city) { $city = $v.city.name }
      if ($v.state) { $state = $v.state.stateCode }
      if ($v.location) { $latv = $v.location.latitude; $lngv = $v.location.longitude }
    }

    # Pick an image
    $img = $null
    if ($e.images) {
      $sortedImgs = $e.images | Sort-Object @{Expression="width";Descending=$false}
      $img = $sortedImgs | Where-Object { $_.width -ge 640 } | Select-Object -First 1
      if (-not $img) { $img = $sortedImgs | Select-Object -Last 1 }
    }

    $all += [pscustomobject]@{
      id     = $e.id
      source = "ticketmaster"
      title  = $e.name
      url    = $e.url
      start  = $start
      end    = $end
      status = $e.dates.status.code
      venue  = $venueName
      city   = $city
      state  = $state
      lat    = $latv
      lng    = $lngv
      image  = if ($img) { $img.url } else { $null }
    }
  }

  $collected = $all.Count
  Write-Host ("  Page {0}/{1} -> +{2} (total {3})" -f ($page+1),$totalPages,$events.Count,$collected)
  $page++
}

# Ensure output folder
$fullOut = Join-Path (Resolve-Path ".") $Output
$outDir = Split-Path -Parent $fullOut
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Write JSON
$all | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath $fullOut

# Summary
$dates = $all | ForEach-Object {
  try { [datetime]::Parse($_.start) } catch { $null }
} | Where-Object { $_ }
$min = ($dates | Measure-Object -Minimum).Minimum
$max = ($dates | Measure-Object -Maximum).Maximum
Write-Host ""
Write-Host ("✅ Wrote {0} events to {1}" -f $all.Count, $Output) -ForegroundColor Green
if ($min -and $max) {
  Write-Host ("   Range: {0:u} -> {1:u}" -f $min.ToUniversalTime(), $max.ToUniversalTime())
} else {
  Write-Host "   (No parsable dates in results)"
}
