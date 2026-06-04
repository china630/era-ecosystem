# One-time: add GitHub CLI to user PATH (default install: D:\Program Files (x86)\GitHub CLI)
$ghDir = "D:\Program Files (x86)\GitHub CLI"
if (-not (Test-Path "$ghDir\gh.exe")) {
  Write-Error "gh.exe not found at $ghDir"
  exit 1
}
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$ghDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$ghDir", "User")
  Write-Host "Added to user PATH: $ghDir"
}
$env:Path = "$ghDir;" + $env:Path
Write-Host "gh version:" (gh --version)
Write-Host ""
Write-Host "Next (interactive, once): gh auth login"
