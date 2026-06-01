# Adds ERA ecosystem hosts (requires Administrator).
$marker = "# ERA ecosystem (era-365.online)"
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$lines = @(
  $marker,
  "127.0.0.1 era-365.online app.era-365.online api.era-365.online finance-core.era-365.online finance-api.era-365.online",
  "127.0.0.1 hotel-pms.era-365.online fnb-pos.era-365.online clinic.era-365.online retail-pos.era-365.online",
  "127.0.0.1 logistics.era-365.online construction.era-365.online crm.era-365.online auto-service.era-365.online wholesale.era-365.online"
)
$content = Get-Content $hostsPath -Raw -ErrorAction Stop
if ($content -match [regex]::Escape($marker)) {
  Write-Host "ERA hosts block already present."
  exit 0
}
Add-Content -Path $hostsPath -Value "`r`n$($lines -join "`r`n")"
Write-Host "ERA hosts block added."
