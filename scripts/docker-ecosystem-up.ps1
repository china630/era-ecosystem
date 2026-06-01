# Build shared packages image, then full compose stack.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==> Building era-ecosystem/packages:local"
docker build -f docker/Dockerfile.packages -t era-ecosystem/packages:local .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> docker compose up -d --build"
docker compose up -d --build
exit $LASTEXITCODE
