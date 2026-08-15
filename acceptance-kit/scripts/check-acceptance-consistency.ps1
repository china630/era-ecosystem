# Portable Acceptance Kit - consistency gate
# Canon: docs/products/Product-Acceptance-Standard.md
# Customize $required / $forbidBareGa / $excludeName for your repo.
# Optional: kit-config.yaml next to this script's parent (repo root) or via -ConfigPath.

[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$ConfigPath = ""
)

$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
    $here = Split-Path -Parent $MyInvocation.MyCommand.Path
    $RepoRoot = (Resolve-Path (Join-Path $here "..")).Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Add-Fail {
    param([string]$Message)
    [void]$failures.Add($Message)
    Write-Host ("FAIL: " + $Message) -ForegroundColor Red
}

# Defaults (override via kit-config.yaml if present)
$docsRoots = @("docs", "reports")
$excludeName = @(
    "Product-Acceptance-Standard.md",
    "Acceptance-Honesty-Audit.md"
)
$required = @(
    "docs\products\Product-Acceptance-Standard.md",
    ".cursor\rules\task-acceptance.mdc"
)
$forbidBareGa = @()

function Read-KitConfig {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $raw = Get-Content -LiteralPath $Path -Raw
    # Minimal YAML subset: products[].*_matrix / acceptance_system, forbid_bare_ga_in, exclude_md_names, docs_roots, canon_path
    $cfg = @{
        required = New-Object System.Collections.Generic.List[string]
        forbid   = New-Object System.Collections.Generic.List[string]
        exclude  = New-Object System.Collections.Generic.List[string]
        docs     = New-Object System.Collections.Generic.List[string]
    }
    if ($raw -match '(?m)^\s*canon_path:\s*(.+)\s*$') {
        [void]$cfg.required.Add(($Matches[1].Trim().Trim('"').Trim("'") -replace '/', '\'))
    }
    foreach ($line in ($raw -split "`n")) {
        if ($line -match '^\s*-\s+(docs/.+\.md)\s*$' -or $line -match '^\s*-\s+(docs\\.+\.md)\s*$') {
            $p = $Matches[1].Trim() -replace '/', '\'
            if ($p -match 'Matrix|Acceptance-System|Evidence|Standard') {
                [void]$cfg.required.Add($p)
            }
        }
        if ($line -match '^\s*(acceptance_system|readiness_matrix|implementation_matrix|evidence_rules):\s*(.+)\s*$') {
            [void]$cfg.required.Add(($Matches[2].Trim().Trim('"').Trim("'") -replace '/', '\'))
        }
        if ($line -match '^\s*-\s+([\w\-./]+\.yaml)\s*$' -and $raw -match 'forbid_bare_ga_in:') {
            # collected in second pass
        }
        if ($line -match '^\s*-\s+([\w\-.]+\.md)\s*$' -and $line -notmatch 'docs/') {
            [void]$cfg.exclude.Add($Matches[1].Trim())
        }
        if ($line -match '^\s*-\s+(docs|reports)\s*$') {
            [void]$cfg.docs.Add($Matches[1].Trim())
        }
    }
    $inForbid = $false
    foreach ($line in ($raw -split "`n")) {
        if ($line -match '^\s*forbid_bare_ga_in:\s*$') { $inForbid = $true; continue }
        if ($inForbid) {
            if ($line -match '^\S') { $inForbid = $false; continue }
            if ($line -match '^\s*-\s+(.+)\s*$') {
                [void]$cfg.forbid.Add($Matches[1].Trim().Trim('"').Trim("'"))
            }
        }
    }
    $inExclude = $false
    foreach ($line in ($raw -split "`n")) {
        if ($line -match '^\s*exclude_md_names:\s*$') { $inExclude = $true; continue }
        if ($inExclude) {
            if ($line -match '^\S') { $inExclude = $false; continue }
            if ($line -match '^\s*-\s+(.+)\s*$') {
                [void]$cfg.exclude.Add($Matches[1].Trim().Trim('"').Trim("'"))
            }
        }
    }
    return $cfg
}

$candidates = @(
    $ConfigPath,
    (Join-Path $RepoRoot "kit-config.yaml"),
    (Join-Path $RepoRoot "acceptance-kit\kit-config.yaml")
) | Where-Object { $_ -and $_.Trim() -ne "" }

foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) {
        $parsed = Read-KitConfig -Path $c
        if ($null -ne $parsed) {
            if ($parsed.required.Count -gt 0) {
                $required = @($parsed.required | Select-Object -Unique)
                if ($required -notcontains ".cursor\rules\task-acceptance.mdc") {
                    $required += ".cursor\rules\task-acceptance.mdc"
                }
            }
            if ($parsed.forbid.Count -gt 0) { $forbidBareGa = @($parsed.forbid) }
            if ($parsed.exclude.Count -gt 0) { $excludeName = @($parsed.exclude | Select-Object -Unique) }
            if ($parsed.docs.Count -gt 0) { $docsRoots = @($parsed.docs) }
            Write-Host ("Loaded kit-config: " + $c)
        }
        break
    }
}

# Use \u2705 for checkmark to avoid file-encoding issues on Windows PowerShell 5.1
$check = [char]0x2705
$banned = @(
    @{ Name = "all-checkmark-bold";   Pattern = ("Scaffold AC \*\*all " + $check + "\*\*") },
    @{ Name = "matrix-all-checkmark"; Pattern = ("Matrix \*\*all " + $check + "\*\*") },
    @{ Name = "all-scaffold-green";   Pattern = ("all Scaffold " + $check + "|Scaffold AC all green|PRD AC all " + $check) },
    @{ Name = "ga-partner";           Pattern = 'ga \(partner\)' },
    @{ Name = "ga-greenfield";        Pattern = 'ga \(greenfield\)' }
)

Write-Host ("Acceptance consistency check - " + $RepoRoot)

foreach ($relRoot in $docsRoots) {
    $root = Join-Path $RepoRoot $relRoot
    if (-not (Test-Path -LiteralPath $root)) { continue }
    Get-ChildItem -LiteralPath $root -Recurse -File -Filter *.md | ForEach-Object {
        if ($excludeName -contains $_.Name) { return }
        $text = [System.IO.File]::ReadAllText($_.FullName)
        $rel = $_.FullName.Substring($RepoRoot.Length).TrimStart("\", "/")
        foreach ($b in $banned) {
            if ([regex]::IsMatch($text, $b.Pattern)) {
                Add-Fail ($b.Name + " in " + $rel)
            }
        }
    }
}

function Test-YamlHasBareGa {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $lines = [System.IO.File]::ReadAllLines($Path)
    foreach ($line in $lines) {
        if ($line -match '^\s*status:\s*ga\s*$') { return $true }
    }
    return $false
}

foreach ($yamlRel in $forbidBareGa) {
    $yp = Join-Path $RepoRoot ($yamlRel -replace '/', '\')
    if (Test-YamlHasBareGa $yp) {
        Add-Fail ($yamlRel + " has status: ga; expected non-ga until Pilot-ready")
    }
}

foreach ($r in $required) {
    $norm = $r -replace '/', '\'
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $norm))) {
        Add-Fail ("missing required SSOT: " + $norm)
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host (($failures.Count).ToString() + " acceptance consistency failure(s).") -ForegroundColor Red
    exit 1
}

Write-Host "PASS - no banned false-green / false-ga prose; SSOT files present." -ForegroundColor Green
exit 0
