# User documentation (ERA ecosystem)

## Политика: in-app FAQ и юридические страницы

Внешние PDF/HTML-мануалы и отдельные «движки» документации **не ведём**. Пользовательский контент — **i18n / messages** в приложении.

| Контур | FAQ | Terms | Где править текст |
|--------|-----|-------|-------------------|
| **Platform (Orchestrator)** | [`/help`](http://127.0.0.1:3000/help) — **канонический FAQ** | [`/terms`](http://127.0.0.1:3000/terms) | `era-orchestrator/apps/web/messages/*.json` → `help`, `terms` |
| **Finance** | Лендинг [`/#faq`](http://127.0.0.1:3100/#faq); `/help` → redirect | Ссылка на Orch `/terms` с login | `era-finance-core/packages/i18n/src/landing-copy.ts` → `faq` |
| **Industry satellites** | Footer / help → Orch `/help` | Footer → Orch `/terms` | `era-*/messages/*.json`; ссылки через `orchPublicHref()` |
| **Hotel / FB** | Orch `/help` (footer); локальный FAQ по мере добавления | Orch `/terms` | `era-hotel-pms`, `era-fnb-pos` messages |

**Публичный прайс:** [`/pricing`](http://127.0.0.1:3000/pricing) на Orchestrator (`GET /v1/public/pricing`). Finance `/pricing` → redirect на Orch.

**Регистрация и партнёрка:** `/register`, `/register-org`, `/partner` — только Orchestrator web.

**Юридические ссылки (legacy env):** `NEXT_PUBLIC_ERA_*_RU` / `_AZ` — fallback для футера `@era/satellite-kit/ui` → `PublicLegalFooter`, если Orch URL не задан.

## Язык UI

- Контракт: **az | ru | en**, default **az**, cookie **`era_i18n_lang`**.
- Переключатель: **`SatelliteHeaderLocale`** / `SatelliteLocaleToggle` на **login**; после входа — в **global header** (`EraAppHeader`, справа в кластере профиля). Finance: `LanguageSwitcher` в том же месте.
- На `/login` переключатель справа от заголовка; `POST /api/locale` доступен без JWT.
- Матрица стеков: [SATELLITE_DOCUMENTATION.md § i18n stacks](./SATELLITE_DOCUMENTATION.md#i18n-stacks-ecosystem-contract).
- Синхронизация ключей `auth.*`: `node tools/sync-i18n-parity.mjs`.

## Шаблон login (все продукты)

- **UI:** `@era/satellite-kit/ui` → `AuthLoginCard` ([DESIGN.md](../DESIGN.md))
- **Ссылки под формой:** регистрация → Orch; pricing → Orch `/pricing`; FAQ → Orch `/help`; оферта → Orch `/terms`
- **Finance login:** тот же порядок ссылок; `NEXT_PUBLIC_ORCH_WEB_URL=http://127.0.0.1:3000`

## Что удалено (не восстанавливать)

- `docs/manual-accountant/` — промо-мануал
- `era-finance-core/tools/md_to_*.py`, `playwright-screenshots/` — генерация промо

## Внутренний QA (не user docs)

- `era-finance-core/docs/manual-qa/` — ручной E2E для тестировщиков.

## Связанные документы

- [ECOSYSTEM_URLS.md](./ECOSYSTEM_URLS.md) — public hub routes
- [SATELLITE_DOCUMENTATION.md](./SATELLITE_DOCUMENTATION.md)
- [SETUP_AND_RUN.md](./SETUP_AND_RUN.md)
