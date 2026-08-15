# Install portable acceptance-kit into a target git repo.
# Usage (from target repo root):
#   pwsh -File path\to\acceptance-kit\scripts\install-acceptance-kit.ps1 -TargetRepo .
# Options:
#   -CopyTemplates   also copy docs/templates/* into docs/ (as stubs)
#   -ConfigPath      path to kit-config.yaml (default: beside kit README)

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TargetRepo,
    [string]$KitRoot = "",
    [string]$ConfigPath = "",
    [switch]$CopyTemplates,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not $KitRoot) {
    $KitRoot = (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..")).Path
}
$TargetRepo = (Resolve-Path $TargetRepo).Path

Write-Host "Kit:    $KitRoot"
Write-Host "Target: $TargetRepo"

function Copy-KitItem {
    param(
        [string]$RelativeSource,
        [string]$RelativeDest
    )
    $src = Join-Path $KitRoot $RelativeSource
    $dst = Join-Path $TargetRepo $RelativeDest
    $dstDir = Split-Path -Parent $dst
    if (-not (Test-Path -LiteralPath $dstDir)) {
        New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
    }
    if ((Test-Path -LiteralPath $dst) -and -not $Force) {
        Write-Host ("skip (exists): " + $RelativeDest)
        return
    }
    Copy-Item -LiteralPath $src -Destination $dst -Force
    Write-Host ("copied: " + $RelativeDest)
}

# Cursor surface
Copy-KitItem "cursor\hooks.json" ".cursor\hooks.json"
Copy-KitItem "cursor\hooks\before-shell.mjs" ".cursor\hooks\before-shell.mjs"
Copy-KitItem "cursor\hooks\stop-closeout.mjs" ".cursor\hooks\stop-closeout.mjs"
Copy-KitItem "cursor\rules\task-acceptance.mdc" ".cursor\rules\task-acceptance.mdc"
Copy-KitItem "cursor\rules\quality-tooling.mdc" ".cursor\rules\quality-tooling.mdc"
Copy-KitItem "cursor\skills\acceptance-closeout\SKILL.md" ".cursor\skills\acceptance-closeout\SKILL.md"
Copy-KitItem "cursor\skills\quality-gates\SKILL.md" ".cursor\skills\quality-gates\SKILL.md"

# Scripts + canon
Copy-KitItem "scripts\check-acceptance-consistency.ps1" "scripts\check-acceptance-consistency.ps1"
Copy-KitItem "docs\products\Product-Acceptance-Standard.md" "docs\products\Product-Acceptance-Standard.md"

# Optional config
$cfgSrc = if ($ConfigPath) { $ConfigPath } else { Join-Path $KitRoot "kit-config.example.yaml" }
$cfgDst = Join-Path $TargetRepo "kit-config.yaml"
if (-not (Test-Path -LiteralPath $cfgDst) -or $Force) {
    Copy-Item -LiteralPath $cfgSrc -Destination $cfgDst -Force
    Write-Host "copied: kit-config.yaml (edit product paths)"
} else {
    Write-Host "skip (exists): kit-config.yaml"
}

if ($CopyTemplates) {
    $tplRoot = Join-Path $KitRoot "docs\templates"
    $outRoot = Join-Path $TargetRepo "docs\templates"
    if (-not (Test-Path -LiteralPath $outRoot)) {
        New-Item -ItemType Directory -Path $outRoot -Force | Out-Null
    }
    Get-ChildItem -LiteralPath $tplRoot -File | ForEach-Object {
        $dest = Join-Path $outRoot $_.Name
        if ((Test-Path -LiteralPath $dest) -and -not $Force) {
            Write-Host ("skip (exists): docs\templates\" + $_.Name)
        } else {
            Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
            Write-Host ("copied: docs\templates\" + $_.Name)
        }
    }
}

Write-Host ""
Write-Host "Next:"
Write-Host "  1) Edit kit-config.yaml and .cursor/rules/task-acceptance.mdc product table"
Write-Host "  2) From docs/templates, create per-product Matrix / Acceptance-System files"
Write-Host "  3) pwsh -File scripts/check-acceptance-consistency.ps1"
Write-Host "  4) Ensure Node.js is on PATH; reopen the folder in Cursor"
