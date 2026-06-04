# Per-module commits on integration branch. Usage: .\scripts\commit-by-module.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Commit-Paths($message, $paths) {
  $existing = @($paths | Where-Object { Test-Path $_ })
  if ($existing.Count -eq 0) { Write-Host "SKIP (no paths): $message"; return }
  git add @existing
  $status = git diff --cached --quiet 2>$null; if ($LASTEXITCODE -eq 0) { Write-Host "SKIP (empty): $message"; git reset HEAD -q; return }
  git commit -m $message
  Write-Host "OK: $message"
}

Commit-Paths "feat(orchestrator): MDM FIN lookup, network deliver, hotel module keys" @(
  "era-orchestrator"
)
Commit-Paths "feat(data-hub): docker build fixes and API health tests" @(
  "era-data-hub"
)
Commit-Paths "feat(finance-core): core waves 1-4 orchestrator network UX" @(
  "era-finance-core"
)
foreach ($sat in @(
  "era-hotel-pms", "era-fnb-pos", "era-clinic", "era-retail-pos",
  "era-logistics", "era-construction", "era-crm", "era-auto-service", "era-wholesale"
)) {
  Commit-Paths "feat($sat): integration updates" @($sat)
}
Commit-Paths "chore(packages): shared contracts and satellite-kit" @(
  "packages"
)
Commit-Paths "chore(docker): migrate scripts, bootstrap, nightly smoke fixes" @(
  "docker", "tools/bootstrap-local.mjs", "scripts"
)
Commit-Paths "chore(ci): workflows and env templates" @(
  ".github", ".env.example", ".env.production.example", ".env.ci.example"
)
Commit-Paths "docs: roadmap, readiness, security audit, next-day plan" @(
  "docs"
)

Write-Host "Done. Remaining:"
git status --short
