# GitHub CLI (Windows)

Нужен для `gh run watch`, `gh pr create`, просмотра логов Actions.

## Установка

1. Скачать MSI: https://github.com/cli/cli/releases/latest (`gh_*_windows_amd64.msi`)
2. Или: `winget install GitHub.cli` (при ошибке сертификата — MSI вручную)

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
