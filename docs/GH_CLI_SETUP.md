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

```powershell
gh auth login
# GitHub.com → HTTPS → Login with browser или token (repo, workflow, read:packages)
gh auth status
gh repo view china630/era-ecosystem
```

## Полезные команды

```powershell
gh run list --repo china630/era-ecosystem --branch integration/stabilize-20260605
gh run watch
gh run view <run-id> --log-failed
gh pr create --base dev --head integration/stabilize-20260605 --title "chore: ecosystem stabilize" --body "..."
```
