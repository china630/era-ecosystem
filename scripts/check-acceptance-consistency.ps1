# Portable Acceptance Kit - consistency gate (Windows)
# Prefer: npm run check:acceptance (Node primary for CI)
# Canon: docs/products/ERA-Acceptance-Standard.md

[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [switch]$Strict,
    [string]$Product = ""
)

$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
    $here = Split-Path -Parent $MyInvocation.MyCommand.Path
    $RepoRoot = (Resolve-Path (Join-Path $here "..")).Path
}

$node = Join-Path $RepoRoot "scripts\check-acceptance-consistency.mjs"
$argsList = @($node)
if ($Strict) { $argsList += "--strict" }
if ($Product) { $argsList += @("--product", $Product) }

Push-Location $RepoRoot
try {
    & node @argsList
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
