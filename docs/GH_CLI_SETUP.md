# GitHub CLI (Windows)

Нужен для `gh run watch`, `gh pr create`, просмотра логов Actions.

## Установка

Путь по умолчанию в этом проекте: `D:\Program Files (x86)\GitHub CLI\gh.exe`

```powershell
# Добавить в PATH (один раз)
.\scripts\setup-gh-path.ps1
```

Альтернатива: MSI с https://github.com/cli/cli/releases/latest или `winget install GitHub.cli`.

## Авторизация

PATH уже добавлен скриптом `scripts/setup-gh-path.ps1` (перезапустите терминал/Cursor, если `gh` не находится).

```powershell
gh auth login
# GitHub.com → HTTPS → Login with browser или token (repo, workflow, read:packages, read:org)
gh auth status
gh repo view china630/era-ecosystem
```

Для API-команд (`gh run watch`, `gh pr create`) достаточно переменной `GH_TOKEN` с правами `repo` — её можно взять из Git Credential Manager, если `git push` уже работает:

```powershell
$env:GH_TOKEN = (echo "protocol=https`nhost=github.com" | git credential fill | Select-String '^password=').ToString().Replace('password=','')
gh run list --repo china630/era-ecosystem
```

## Полезные команды

```powershell
gh run list --repo china630/era-ecosystem --branch integration/stabilize-20260605
gh run watch
gh run view <run-id> --log-failed
gh pr create --base dev --head integration/stabilize-20260605 --title "chore: ecosystem stabilize" --body "..."
```
