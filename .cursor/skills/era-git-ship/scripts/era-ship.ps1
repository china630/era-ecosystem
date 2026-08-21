# ERA ordered git commit + optional PR publish helper (Windows PowerShell).
# Usage:
#   .\era-ship.ps1 -ListScopes
#   .\era-ship.ps1 -Scope orchestrator -Subject "pricing seeds" [-Branch integration/my-wave]
#   .\era-ship.ps1 -Wave full -Subject "ecosystem integration wave" [-Branch integration/ecosystem-wave]
#   .\era-ship.ps1 -PublishDev -Head integration/ecosystem-wave [-Title "..."] [-Body "..."] [-SkipGates]
#   .\era-ship.ps1 -PublishMaster -Head dev [-SkipGates]

param(
    [switch]$ListScopes,
    [ValidateSet("orchestrator", "data-hub", "mdm", "finance", "bank-core", "bank", "packages", "platform", "rest",
        "hotel", "clinic", "wholesale", "logistics", "construction", "crm", "auto-service", "fnb-pos", "retail-pos")]
    [string]$Scope,
    [switch]$Wave,
    [string]$Subject = "",
    [string]$Body = "",
    [string]$Branch = "",
    [switch]$PublishDev,
    [switch]$PublishMaster,
    [string]$Head = "",
    [string]$Title = "",
    [switch]$DryRun,
    [switch]$SkipGates
)

$ErrorActionPreference = "Stop"
$RepoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $RepoRoot) { throw "Not inside a git repository." }
Set-Location $RepoRoot

function Install-EraGitHook {
    $install = Join-Path $RepoRoot "scripts\install-era-git-hooks.mjs"
    if (-not (Test-Path $install)) { return }
    if ($DryRun) { Write-Host "[dry-run] node scripts/install-era-git-hooks.mjs"; return }
    node $install
    if ($LASTEXITCODE -ne 0) { Write-Warning "Could not install .git/hooks/pre-push" }
}

function Invoke-ShipPrepush {
    param([switch]$QualityOnly)
    if ($SkipGates -or $env:ERA_SHIP_SKIP_GATES -eq "1") {
        Write-Warning "SkipGates / ERA_SHIP_SKIP_GATES — not running local ship gates."
        return
    }
    $script = Join-Path $RepoRoot "scripts\era-ship-prepush.mjs"
    if (-not (Test-Path $script)) { throw "Missing scripts/era-ship-prepush.mjs" }
    $gateArgs = @($script)
    if ($QualityOnly) { $gateArgs += "--quality-only" }
    if ($DryRun) {
        Write-Host "[dry-run] node $($gateArgs -join ' ')"
        return
    }
    Write-Host "==> local ship gates (quality-gates + scoped test/build)"
    node @gateArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Local ship gates FAILED — not pushing. Fix, new commit, re-run. Do not skip unless the user explicitly said SkipGates."
    }
    $env:ERA_SHIP_GATES_DONE = "1"
}

function Ensure-GhAuth {
    if ($env:GH_TOKEN -or $env:GITHUB_TOKEN) { return }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { return }
    try {
        $cred = "protocol=https`nhost=github.com`n" | git credential fill 2>$null
        $match = $cred | Select-String '^password=(.+)$'
        if ($match) {
            $env:GH_TOKEN = $match.Matches[0].Groups[1].Value
        }
    }
    catch {
        # fall through — gh auth status will report clearly
    }
}

$ManifestPath = Join-Path $PSScriptRoot "..\manifests.yaml"
if (-not (Test-Path $ManifestPath)) { throw "Missing manifests.yaml at $ManifestPath" }

function Read-YamlManifest {
    param([string]$Path)
    # Minimal YAML reader for this manifest (no external deps).
    $text = Get-Content -Raw -Path $Path
    $result = @{ full_wave_order = @(); scopes = @{}; satellites = @{}; never_commit = @() }
    $section = $null
    $current = $null
    $currentKey = $null
    foreach ($line in ($text -split "`n")) {
        $trim = $line.TrimEnd()
        if ($trim -match '^full_wave_order:\s*$') { $section = 'wave'; continue }
        if ($trim -match '^scopes:\s*$') { $section = 'scopes'; $current = $null; continue }
        if ($trim -match '^satellites:\s*$') { $section = 'satellites'; $current = $null; continue }
        if ($trim -match '^never_commit:\s*$') { $section = 'never'; continue }

        if ($section -eq 'wave' -and $trim -match '^\s*-\s+(\S+)') {
            $result.full_wave_order += $Matches[1]
            continue
        }
        if ($section -eq 'never' -and $trim -match '^\s*-\s+(.+)') {
            $result.never_commit += $Matches[1].Trim()
            continue
        }
        if ($section -eq 'scopes' -and $trim -match '^  (\S+):\s*$') {
            $current = $Matches[1]
            $result.scopes[$current] = @{ paths = @(); also_stage_if_touched = @(); path_globs = @(); commit_prefix = "" }
            continue
        }
        if ($section -eq 'satellites' -and $trim -match '^  (\S+):\s*$') {
            $current = $Matches[1]
            $result.satellites[$current] = @{ dir = ""; commit_prefix = "" }
            continue
        }
        if ($null -eq $current) { continue }
        if ($trim -match '^\s+dir:\s+(.+)') {
            if ($section -eq 'satellites') { $result.satellites[$current].dir = $Matches[1].Trim() }
            continue
        }
        if ($trim -match '^\s+commit_prefix:\s+"(.+)"') {
            if ($section -eq 'scopes') { $result.scopes[$current].commit_prefix = $Matches[1] }
            if ($section -eq 'satellites') { $result.satellites[$current].commit_prefix = $Matches[1] }
            continue
        }
        if ($trim -match '^\s+-\s+(.+)') {
            $val = $Matches[1].Trim()
            if ($section -eq 'scopes') {
                if ($currentKey -eq 'paths' -or $line -match '^\s+paths:') { } 
                if ($line -match 'paths:' -or ($result.scopes[$current].paths.Count -eq 0 -and $trim -notmatch 'also_stage|path_globs|commit_prefix|label|aliases')) {
                    # detect list context from previous line — simplified: append to last opened list key
                }
            }
        }
    }
    return $result
}

# Robust manifest load via regex blocks (keep script self-contained).
function Get-Manifest {
    $raw = Get-Content -Raw $ManifestPath
    $m = @{
        full_wave_order = @('orchestrator', 'data-hub', 'mdm', 'rest')
        scopes          = @{}
        satellites      = @{}
        never_commit    = @('docker-data/', '.env', '.env.local', '.cursor/', 'node_modules/')
    }

    function Parse-ListBlock {
        param([string]$Block)
        [regex]::Matches($Block, '(?m)^\s*-\s+(.+)$') | ForEach-Object { $_.Groups[1].Value.Trim() }
    }

    if ($raw -match '(?s)scopes:\s*\n(.*?)satellites:') {
        $scopesRaw = $Matches[1]
        [regex]::Matches($scopesRaw, '(?ms)^  (\w[\w-]*):\s*\n(.*?)(?=^  \w|\z)') | ForEach-Object {
            $name = $_.Groups[1].Value
            $body = $_.Groups[2].Value
            $entry = @{
                paths                   = @()
                also_stage_if_touched   = @()
                path_globs              = @()
                commit_prefix           = ""
            }
            if ($body -match 'commit_prefix:\s*"([^"]+)"') { $entry.commit_prefix = $Matches[1] }
            if ($body -match '(?s)paths:\s*\n((?:\s+-\s+.+\n?)*)') { $entry.paths = @(Parse-ListBlock $Matches[1]) }
            if ($body -match '(?s)also_stage_if_touched:\s*\n((?:\s+-\s+.+\n?)*)') { $entry.also_stage_if_touched = @(Parse-ListBlock $Matches[1]) }
            if ($body -match '(?s)path_globs:\s*\n((?:\s+-\s+.+\n?)*)') { $entry.path_globs = @(Parse-ListBlock $Matches[1]) }
            $m.scopes[$name] = $entry
        }
    }

    if ($raw -match '(?s)satellites:\s*\n(.*?)never_commit:') {
        $satRaw = $Matches[1]
        [regex]::Matches($satRaw, '(?ms)^  (\w[\w-]*):\s*\n(.*?)(?=^  \w|\z)') | ForEach-Object {
            $name = $_.Groups[1].Value
            $body = $_.Groups[2].Value
            $dir = ""
            $prefix = "feat($name)"
            if ($body -match 'dir:\s+(\S+)') { $dir = $Matches[1] }
            if ($body -match 'commit_prefix:\s*"([^"]+)"') { $prefix = $Matches[1] }
            $m.satellites[$name] = @{ dir = $dir; commit_prefix = $prefix }
        }
    }

    if ($raw -match '(?s)never_commit:\s*\n((?:\s+-\s+.+\n?)*)') {
        $m.never_commit = @(Parse-ListBlock $Matches[1])
    }

    return $m
}

function Test-NeverCommit {
    param([string]$Path, [string[]]$Patterns)
    # Prefix / glob only — never bare substring (e.g. "data/" must not exclude "database/" or "admin/data/").
    $normPath = ($Path -replace '\\', '/').TrimStart('./')
    foreach ($p in $Patterns) {
        $pat = ($p -replace '\\', '/').Trim()
        if (-not $pat) { continue }
        if ($pat.StartsWith('**/')) {
            $suffix = $pat.Substring(3).TrimStart('/')
            if ($normPath -eq $suffix -or $normPath.EndsWith("/$suffix") -or $normPath -like "*/$suffix" -or $normPath -like "*/$suffix/*") { return $true }
            continue
        }
        if ($normPath -eq $pat.TrimEnd('/') -or $normPath.StartsWith($pat)) { return $true }
    }
    return $false
}

function Get-ChangedFiles {
    $files = @()
    git status --porcelain | ForEach-Object {
        $line = $_.Substring(3)
        if ($line -match '^(.+) -> (.+)$') { $files += $Matches[2] } else { $files += $line.Trim('"') }
    }
    $files | Where-Object { -not (Test-NeverCommit $_ $manifest.never_commit) } | Select-Object -Unique
}

function Test-PathMatch {
    param([string]$File, [hashtable]$Entry, [string]$SatelliteDir = "")
    foreach ($p in $Entry.paths) {
        if ($File -eq $p -or $File.StartsWith($p)) { return $true }
    }
    foreach ($g in $Entry.path_globs) {
        $pattern = $g -replace '\*\*', '.*' -replace '/', '[\\/]'
        if ($File -match $pattern) { return $true }
    }
    if ($SatelliteDir -and $File.StartsWith("$SatelliteDir/")) { return $true }
    return $false
}

function Resolve-ScopeEntry {
    param([string]$Name)
    if ($manifest.scopes.ContainsKey($Name)) { return $manifest.scopes[$Name] }
    if ($manifest.satellites.ContainsKey($Name)) {
        $sat = $manifest.satellites[$Name]
        return @{ paths = @("$($sat.dir)/"); also_stage_if_touched = @(); path_globs = @(); commit_prefix = $sat.commit_prefix }
    }
    throw "Unknown scope: $Name"
}

function Get-ScopeName {
    param([string]$File)
    foreach ($wave in $manifest.full_wave_order) {
        if ($wave -eq 'rest') { continue }
        $entry = $manifest.scopes[$wave]
        if (Test-PathMatch $File $entry) { return $wave }
    }
    foreach ($satName in $manifest.satellites.Keys) {
        $dir = $manifest.satellites[$satName].dir
        if ($File.StartsWith("$dir/")) { return 'rest' }
    }
    return 'rest'
}

function Stage-ScopeFiles {
    param([string]$ScopeName, [string[]]$Files)
    $entry = Resolve-ScopeEntry $ScopeName
    $toStage = @()
    foreach ($f in $Files) {
        if (Test-PathMatch $f $entry $(if ($manifest.satellites.ContainsKey($ScopeName)) { $manifest.satellites[$ScopeName].dir } else { "" })) {
            $toStage += $f
        }
    }
    foreach ($extra in $entry.also_stage_if_touched) {
        if ($Files -contains $extra) { $toStage += $extra }
    }
    $toStage = $toStage | Select-Object -Unique
    if ($toStage.Count -eq 0 -and $ScopeName -eq 'rest' -and $Files.Count -gt 0) {
        $toStage = @($Files | Where-Object { -not (Test-NeverCommit $_ $manifest.never_commit) })
    }
    if ($toStage.Count -eq 0) { return 0 }
    foreach ($f in $toStage) {
        if ($DryRun) { Write-Host "[dry-run] git add $f" }
        else { git add -- "$f" }
    }
    return $toStage.Count
}

function New-CommitMessage {
    param([string]$ScopeName, [string]$Subj, [string]$Bod)
    $entry = Resolve-ScopeEntry $ScopeName
    $prefix = $entry.commit_prefix
    if (-not $Subj) {
        $Subj = switch ($ScopeName) {
            'orchestrator' { 'control plane updates' }
            'data-hub' { 'reference registry and consumer clients' }
            'mdm' { 'person identity contracts and BFF wiring' }
            'rest' { 'satellite integration gaps and platform docs' }
            default { "$ScopeName updates" }
        }
    }
    $title = "$prefix`: $Subj"
    if ($DryRun) {
        if ($Bod) { Write-Host "[dry-run] git commit -m `"$title`" -m `"$Bod`"" }
        else { Write-Host "[dry-run] git commit -m `"$title`"" }
        return
    }
    if ($Bod) { git commit -m $title -m $Bod }
    else { git commit -m $title }
}

function Ensure-Branch {
    param([string]$Name)
    if (-not $Name) { return }
    $current = git branch --show-current
    if ($current -ne $Name) {
        if ($DryRun) { Write-Host "[dry-run] git checkout -b $Name"; return }
        git rev-parse --verify $Name 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { git checkout $Name }
        else { git checkout -b $Name }
    }
}

function Invoke-PublishDev {
    param([string]$HeadBranch, [string]$PrTitle, [string]$PrBody)
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "gh CLI not found. Run: gh auth login" }
    Ensure-GhAuth
    gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "gh not authenticated. Set GH_TOKEN or run: gh auth login" }

    Install-EraGitHook
    Invoke-ShipPrepush

    if ($DryRun) {
        Write-Host "[dry-run] git push -u origin $HeadBranch"
        Write-Host "[dry-run] gh pr create --base dev --head $HeadBranch ..."
        Write-Host "[dry-run] gh pr merge --merge (after CI green; --auto if repo allows)"
        return
    }
    git push -u origin $HeadBranch
    $prArgs = @('pr', 'create', '--base', 'dev', '--head', $HeadBranch, '--title', $PrTitle)
    if ($PrBody) { $prArgs += @('--body', $PrBody) }
    $prUrl = gh @prArgs
    Write-Host $prUrl
    gh pr merge --merge --auto
}

function Invoke-PublishMaster {
    param([string]$HeadBranch)
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "gh CLI not found. Run: gh auth login" }
    Ensure-GhAuth
    gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "gh not authenticated. Set GH_TOKEN or run: gh auth login" }

    git fetch origin dev master | Out-Null
    $title = "release: promote dev to master"
    Install-EraGitHook
    Invoke-ShipPrepush -QualityOnly
    if ($DryRun) {
        Write-Host "[dry-run] gh pr create --base master --head $HeadBranch --title '$title'"
        Write-Host "[dry-run] gh pr merge --merge (after CI green)"
        return
    }
    $prUrl = gh pr create --base master --head $HeadBranch --title $title --body "Promote integrated dev branch to master after CI green."
    Write-Host $prUrl
    gh pr merge --merge
}

$manifest = Get-Manifest

if ($ListScopes) {
    Write-Host "Full wave order: $($manifest.full_wave_order -join ' -> ')"
    Write-Host "`nCore scopes:"
    $manifest.scopes.Keys | Sort-Object | ForEach-Object { Write-Host "  $_" }
    Write-Host "`nSatellites:"
    $manifest.satellites.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Host "  $($_.Key) -> $($_.Value.dir)" }
    exit 0
}

Ensure-Branch $Branch

$changed = @(Get-ChangedFiles)
if ($changed.Count -eq 0 -and -not $PublishDev -and -not $PublishMaster) {
    Write-Host "Nothing to commit (working tree clean or only excluded paths)."
    exit 0
}

if ($Wave) {
    $remaining = [System.Collections.Generic.List[string]]::new()
    foreach ($c in $changed) { [void]$remaining.Add($c) }
    foreach ($waveName in $manifest.full_wave_order) {
        if ($remaining.Count -eq 0) { break }
        $n = Stage-ScopeFiles -ScopeName $waveName -Files @($remaining)
        if ($n -gt 0) {
            # Capture staged paths BEFORE commit (index is empty after a successful commit).
            $stagedBefore = @(git diff --cached --name-only)
            New-CommitMessage -ScopeName $waveName -Subj $Subject -Bod $Body
            foreach ($s in $stagedBefore) { [void]$remaining.Remove($s) }
            # Also drop directory placeholders once children were staged
            $dropDirs = @($remaining | Where-Object { $stagedBefore -like "$_/*" })
            foreach ($d in $dropDirs) { [void]$remaining.Remove($d) }
        }
    }
    if ($remaining.Count -gt 0) {
        Write-Warning "Unbucketed files remain: $($remaining -join ', ')"
    }
}
elseif ($Scope) {
    $n = Stage-ScopeFiles -ScopeName $Scope -Files $changed
    if ($n -eq 0) { Write-Host "No files matched scope '$Scope'."; exit 0 }
    New-CommitMessage -ScopeName $Scope -Subj $Subject -Bod $Body
}
elseif ($PublishDev) {
    if (-not $Head) { $Head = git branch --show-current }
    if (-not $Title) { $Title = "feat: ecosystem wave ($Head)" }
    Invoke-PublishDev -HeadBranch $Head -PrTitle $Title -PrBody $Body
}
elseif ($PublishMaster) {
    if (-not $Head) { $Head = 'dev' }
    Invoke-PublishMaster -HeadBranch $Head
}
else {
    Write-Host "Specify -ListScopes, -Scope, -Wave, -PublishDev, or -PublishMaster. See SKILL.md."
    exit 1
}

Write-Host "Done."
