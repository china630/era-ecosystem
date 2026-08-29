# ERA ordered git commit + optional PR publish helper (Windows PowerShell).
# Usage:
#   .\era-ship.ps1 -ListScopes
#   .\era-ship.ps1 -Scope orchestrator -Subject "pricing seeds" [-Branch integration/my-wave]
#   .\era-ship.ps1 -Wave full -Subject "ecosystem integration wave" [-Branch integration/ecosystem-wave]
#   .\era-ship.ps1 -PublishDev -Head integration/ecosystem-wave [-Title "..."] [-Body "..."] [-SkipGates] [-WaitStaging]
#   .\era-ship.ps1 -PublishImages -Services orchestrator [-Head dev]
#   .\era-ship.ps1 -PublishDeploy -DeployScope orchestrator [-ImageTag dev] [-Head dev]
#   .\era-ship.ps1 -PublishMaster -Head dev [-SkipGates]
#
# PublishDev always waits for PR checks then merges (does not stop at --auto).
# -WaitStaging: after merge, wait for Build and push images + Deploy staging on that SHA.

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
    [switch]$PublishImages,
    [switch]$PublishDeploy,
    [string]$Head = "",
    [string]$Title = "",
    [string]$Services = "",
    [string]$DeployScope = "",
    [string]$ImageTag = "",
    [switch]$WaitStaging,
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
        Write-Warning "SkipGates / ERA_SHIP_SKIP_GATES -- not running local ship gates."
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
        throw "Local ship gates FAILED -- not pushing. Fix, new commit, re-run. Do not skip unless the user explicitly said SkipGates."
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
        # fall through -- gh auth status will report clearly
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
                    # detect list context from previous line -- simplified: append to last opened list key
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
    # Prefix / glob only -- never bare substring (e.g. "data/" must not exclude "database/" or "admin/data/").
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

function Wait-PrChecksThenMerge {
    param([string]$PrRef)
    Write-Host "Waiting for PR checks to pass ($PrRef)..."
    gh pr checks $PrRef --watch --interval 20
    if ($LASTEXITCODE -ne 0) { throw "PR checks failed for $PrRef -- not merging." }
    Write-Host "Merging $PrRef..."
    gh pr merge $PrRef --merge
    if ($LASTEXITCODE -ne 0) { throw "gh pr merge failed for $PrRef" }
    $state = gh pr view $PrRef --json state,mergedAt,mergeCommit --jq '{state,mergedAt,sha:.mergeCommit.oid}'
    Write-Host "Merged: $state"
    return (gh pr view $PrRef --json mergeCommit --jq ".mergeCommit.oid")
}

function Wait-WorkflowOnSha {
    param(
        [string]$WorkflowName,
        [string]$Sha,
        [string]$Branch = "dev",
        [int]$TimeoutSec = 3600
    )
    Write-Host "Waiting for workflow '$WorkflowName' on $Sha..."
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $runId = $null
    while ((Get-Date) -lt $deadline) {
        $json = gh run list --workflow $WorkflowName --branch $Branch --limit 15 --json databaseId,headSha,status,conclusion,url,createdAt |
            ConvertFrom-Json
        $hit = $json | Where-Object { $_.headSha -eq $Sha } | Select-Object -First 1
        if ($hit) {
            $runId = $hit.databaseId
            if ($hit.status -eq "completed") {
                if ($hit.conclusion -eq "success") {
                    Write-Host ("OK {0}: {1}" -f $WorkflowName, $hit.url)
                    return $hit
                }
                if ($hit.conclusion -eq "failure" -or $hit.conclusion -eq "cancelled") {
                    # One automatic rerun for transient infra (e.g. Docker Hub timeout)
                    Write-Warning "$WorkflowName concluded $($hit.conclusion); rerunning failed jobs once..."
                    gh run rerun $runId --failed 2>$null
                    Start-Sleep -Seconds 15
                    gh run watch $runId --exit-status
                    if ($LASTEXITCODE -ne 0) { throw ("{0} failed after rerun: {1}" -f $WorkflowName, $hit.url) }
                    Write-Host ("OK {0} after rerun: {1}" -f $WorkflowName, $hit.url)
                    return $hit
                }
            }
            else {
                gh run watch $runId --exit-status
                if ($LASTEXITCODE -ne 0) {
                    Write-Warning "$WorkflowName watch failed; attempting one rerun of failed jobs..."
                    gh run rerun $runId --failed 2>$null
                    Start-Sleep -Seconds 15
                    gh run watch $runId --exit-status
                    if ($LASTEXITCODE -ne 0) { throw ("{0} failed: see Actions for run {1}" -f $WorkflowName, $runId) }
                }
                Write-Host ("OK {0} (watched)" -f $WorkflowName)
                return $hit
            }
        }
        Start-Sleep -Seconds 15
    }
    throw ("Timeout waiting for '{0}' on sha {1}" -f $WorkflowName, $Sha)
}

function Wait-DeployStagingAfterBuild {
    param([string]$Sha, [int]$TimeoutSec = 2400)
    Write-Host "Waiting for Deploy staging after build of $Sha..."
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $json = gh run list --workflow "deploy-staging.yml" --limit 10 --json databaseId,status,conclusion,url,createdAt,displayTitle,event |
            ConvertFrom-Json
        # Prefer newest in_progress/queued, else newest success after now-5m
        $active = $json | Where-Object { $_.status -in @("queued", "in_progress", "waiting", "pending") } | Select-Object -First 1
        if ($active) {
            Write-Host "Watching Deploy staging $($active.databaseId)..."
            gh run watch $active.databaseId --exit-status
            if ($LASTEXITCODE -ne 0) { throw "Deploy staging failed: $($active.url)" }
            Write-Host ("OK Deploy staging: {0}" -f $active.url)
            return
        }
        $done = $json | Where-Object { $_.status -eq "completed" -and $_.conclusion -eq "success" } | Select-Object -First 1
        if ($done) {
            $created = [datetime]::Parse($done.createdAt).ToUniversalTime()
            if ($created -gt (Get-Date).ToUniversalTime().AddMinutes(-45)) {
                Write-Host ("OK Deploy staging (recent success): {0}" -f $done.url)
                return
            }
        }
        $failed = $json | Where-Object { $_.status -eq "completed" -and $_.conclusion -eq "failure" } | Select-Object -First 1
        if ($failed) {
            $created = [datetime]::Parse($failed.createdAt).ToUniversalTime()
            if ($created -gt (Get-Date).ToUniversalTime().AddMinutes(-45)) {
                throw "Deploy staging failed: $($failed.url)"
            }
        }
        Start-Sleep -Seconds 20
    }
    throw "Timeout waiting for Deploy staging"
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
        Write-Host "[dry-run] wait PR checks -> gh pr merge --merge"
        if ($WaitStaging) { Write-Host "[dry-run] wait Build and push images + Deploy staging" }
        return
    }
    git push -u origin $HeadBranch
    $existing = gh pr list --base dev --head $HeadBranch --state open --json number,url --jq ".[0]"
    $prRef = $null
    if ($existing -and $existing -ne "null") {
        $prObj = $existing | ConvertFrom-Json
        $prRef = $prObj.number
        Write-Host "Reusing open PR #$prRef $($prObj.url)"
    }
    else {
        $prArgs = @('pr', 'create', '--base', 'dev', '--head', $HeadBranch, '--title', $PrTitle)
        if ($PrBody) { $prArgs += @('--body', $PrBody) }
        $prUrl = gh @prArgs
        Write-Host $prUrl
        if ($prUrl -match '/pull/(\d+)') {
            $prRef = $Matches[1]
        }
        else {
            $prRef = gh pr view $HeadBranch --json number --jq ".number"
        }
    }

    # --auto is optional and often rejected; never treat open PR as completion.
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    gh pr merge $prRef --merge --auto 2>$null | Out-Null
    $ErrorActionPreference = $prevEap
    $prState = gh pr view $prRef --json state,mergeCommit | ConvertFrom-Json
    $mergedSha = $null
    if ($prState.state -eq "MERGED" -and $prState.mergeCommit) {
        $mergedSha = $prState.mergeCommit.oid
        Write-Host "PR already merged (auto): $mergedSha"
    }
    else {
        $mergedSha = Wait-PrChecksThenMerge -PrRef $prRef
    }

    if ($WaitStaging) {
        Wait-WorkflowOnSha -WorkflowName "Build and push images" -Sha $mergedSha -Branch "dev"
        Wait-DeployStagingAfterBuild -Sha $mergedSha
        Write-Host "Staging deploy complete for $mergedSha"
    }
}

function Invoke-PublishImages {
    param([string]$HeadBranch, [string]$ServiceList)
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "gh CLI not found. Run: gh auth login" }
    Ensure-GhAuth
    if (-not $HeadBranch) { $HeadBranch = "dev" }
    $wfArgs = @("workflow", "run", "build-images.yml", "--ref", $HeadBranch)
    if ($ServiceList) { $wfArgs += @("-f", "services=$ServiceList") }
    if ($DryRun) {
        Write-Host "[dry-run] gh $($wfArgs -join ' ')"
        return
    }
    gh @wfArgs
    if ($LASTEXITCODE -ne 0) { throw "gh workflow run build-images.yml failed" }
    Write-Host "Dispatched Build and push images (ref=$HeadBranch services=$ServiceList)."
}

function Invoke-PublishDeploy {
    param([string]$HeadBranch, [string]$ScopeName, [string]$Tag)
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "gh CLI not found. Run: gh auth login" }
    Ensure-GhAuth
    if (-not $HeadBranch) { $HeadBranch = "dev" }
    if (-not $ScopeName) { $ScopeName = "orchestrator" }
    if (-not $Tag) { $Tag = "dev" }
    $wfArgs = @("workflow", "run", "deploy-staging.yml", "--ref", $HeadBranch, "-f", "scope=$ScopeName", "-f", "image_tag=$Tag")
    if ($DryRun) {
        Write-Host "[dry-run] gh $($wfArgs -join ' ')"
        return
    }
    gh @wfArgs
    if ($LASTEXITCODE -ne 0) { throw "gh workflow run deploy-staging.yml failed" }
    Write-Host "Dispatched Deploy staging (ref=$HeadBranch scope=$ScopeName tag=$Tag)."
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
    $prRef = gh pr view --json number --jq ".number"
    Wait-PrChecksThenMerge -PrRef $prRef | Out-Null
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
if ($changed.Count -eq 0 -and -not $PublishDev -and -not $PublishMaster -and -not $PublishImages -and -not $PublishDeploy) {
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
elseif ($PublishImages) {
    if (-not $Head) { $Head = "dev" }
    Invoke-PublishImages -HeadBranch $Head -ServiceList $Services
}
elseif ($PublishDeploy) {
    if (-not $Head) { $Head = "dev" }
    Invoke-PublishDeploy -HeadBranch $Head -ScopeName $DeployScope -Tag $ImageTag
}
else {
    Write-Host "Specify -ListScopes, -Scope, -Wave, -PublishDev, -PublishMaster, -PublishImages, or -PublishDeploy. See SKILL.md."
    exit 1
}

Write-Host "Done."
