#Requires -Version 5.1
param(
  [string]$BackupRoot = "D:\ERA-BACKUP\legal-entities",
  [switch]$SkipSnapshot
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$SrcDir = Join-Path $RepoRoot "data\legal-entities"
$CacheSrc = Join-Path $SrcDir ".cache\etaxes-search"

$MasterFiles = @(
  "azerbaijan-companies-with-voen.csv",
  "azerbaijan-companies-without-voen.csv",
  ".companies-master-stats.json"
)

if (-not (Test-Path -LiteralPath $SrcDir)) {
  throw "Source missing: $SrcDir"
}

$LatestMaster = Join-Path $BackupRoot "latest\master"
$LatestCache = Join-Path $BackupRoot "latest\cache\etaxes-search"
New-Item -ItemType Directory -Force -Path $LatestMaster | Out-Null
New-Item -ItemType Directory -Force -Path $LatestCache | Out-Null

$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$copied = @()

foreach ($name in $MasterFiles) {
  $src = Join-Path $SrcDir $name
  if (-not (Test-Path -LiteralPath $src)) {
    Write-Warning "Skip missing: $name"
    continue
  }
  Copy-Item -LiteralPath $src -Destination (Join-Path $LatestMaster $name) -Force
  $copied += $name
  $mb = [math]::Round((Get-Item -LiteralPath $src).Length / 1MB, 1)
  Write-Host "OK master: $name ($mb MB)"
}

if (Test-Path -LiteralPath $CacheSrc) {
  & robocopy $CacheSrc $LatestCache /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:2 | Out-Null
  $code = $LASTEXITCODE
  if ($code -ge 8) { throw "robocopy cache failed with exit $code" }
  $cacheCount = @(Get-ChildItem -LiteralPath $LatestCache -Filter "*.json" -ErrorAction SilentlyContinue).Count
  Write-Host "OK cache: $cacheCount json file(s) -> $LatestCache (robocopy=$code)"
} else {
  Write-Warning "No cache dir yet: $CacheSrc (master still backed up)"
}

if (-not $SkipSnapshot -and $copied.Count -gt 0) {
  $snapMaster = Join-Path $BackupRoot "snapshots\$stamp\master"
  New-Item -ItemType Directory -Force -Path $snapMaster | Out-Null
  foreach ($name in $copied) {
    Copy-Item -LiteralPath (Join-Path $LatestMaster $name) -Destination (Join-Path $snapMaster $name) -Force
  }
  if (Test-Path -LiteralPath $CacheSrc) {
    $snapCache = Join-Path $BackupRoot "snapshots\$stamp\cache\etaxes-search"
    New-Item -ItemType Directory -Force -Path $snapCache | Out-Null
    & robocopy $LatestCache $snapCache /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
    if ($LASTEXITCODE -ge 8) {
      Write-Warning "Snapshot cache robocopy exit $LASTEXITCODE (master snapshot OK)"
    }
  }
  Write-Host "OK snapshot: snapshots\$stamp"
}

$manifest = [ordered]@{
  backed_up_at = (Get-Date).ToString("o")
  repo_root    = $RepoRoot
  source       = $SrcDir
  backup_root  = $BackupRoot
  master_files = $copied
  cache_present = [bool](Test-Path -LiteralPath $CacheSrc)
  note         = "Do not drop git stash that still holds master recovery blobs until latest\ is verified."
}
$manifestPath = Join-Path $BackupRoot "latest\BACKUP_MANIFEST.json"
$manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Host "Wrote $manifestPath"
Write-Host "Backup complete -> $BackupRoot"
