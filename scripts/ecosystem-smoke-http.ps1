# Quick HTTP smoke (Traefik :80). Run after: docker compose up -d
$ErrorActionPreference = "Continue"
$hosts = @(
  @{ Name = "app"; Host = "app.era-365.online"; Path = "/" },
  @{ Name = "api"; Host = "api.era-365.online"; Path = "/api/health" },
  @{ Name = "finance-web"; Host = "finance-core.era-365.online"; Path = "/" },
  @{ Name = "finance-api"; Host = "finance-api.era-365.online"; Path = "/api/health" },
  @{ Name = "hotel-pms"; Host = "hotel-pms.era-365.online"; Path = "/api/health" },
  @{ Name = "fnb-pos"; Host = "fnb-pos.era-365.online"; Path = "/api/health" },
  @{ Name = "retail-pos"; Host = "retail-pos.era-365.online"; Path = "/api/health" },
  @{ Name = "logistics"; Host = "logistics.era-365.online"; Path = "/api/health" },
  @{ Name = "construction"; Host = "construction.era-365.online"; Path = "/api/health" },
  @{ Name = "crm"; Host = "crm.era-365.online"; Path = "/api/health" },
  @{ Name = "auto-service"; Host = "auto-service.era-365.online"; Path = "/api/health" },
  @{ Name = "wholesale"; Host = "wholesale.era-365.online"; Path = "/api/health" },
  @{ Name = "clinic"; Host = "clinic.era-365.online"; Path = "/api/health" }
)
$ok = 0
$fail = 0
foreach ($t in $hosts) {
  try {
    $uri = "http://$($t.Host)$($t.Path)"
    $r = Invoke-WebRequest -Uri $uri -Headers @{ Host = $t.Host } -MaximumRedirection 5 -TimeoutSec 15 -UseBasicParsing
    Write-Host "[OK] $($t.Name) $($r.StatusCode) $uri"
    $ok++
  } catch {
    Write-Host "[FAIL] $($t.Name) $($_.Exception.Message)"
    $fail++
  }
}
Write-Host "`nSmoke: $ok ok, $fail fail"
exit $(if ($fail -gt 0) { 1 } else { 0 })
