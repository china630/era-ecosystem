# Product versioning (ERA ecosystem)

Единые правила для PRD, DELIVERY, MODULES_CATALOG, roadmap и smoke-доков.

## Версии

| Версия | Смысл |
|--------|--------|
| **v1.0** | Текущий релиз: всё со статусом **MVP** / **DONE** в `PRD.md` §4 и `[x]` в DELIVERY. В тексте **не** пишем старые коды волн (W1, W2, SP, Gemini, Wave A–F). |
| **v1.1** | Shipped 2026-05-26: [MODULES_CATALOG § Shipped v1.1](./MODULES_CATALOG.md#shipped-in-v11). |
| **v2.0** | Shipped 2026-05-26: platform CP-B3–B8 **Live**, MDM registration cutover, retail fiscal/offline/marketplace, hotel NBC/B2C/locks, auto tool crib, CRM WA live, clinic portal — [MODULES_CATALOG § Shipped v2.0](./MODULES_CATALOG.md#shipped-in-v20). |
| **v3.0** | Shipped 2026-07-02: CRM party model (M11–M16), prospect import, Finance auto-CP — [MODULES_CATALOG § Shipped v3.0](./MODULES_CATALOG.md#shipped-in-v30). |

## Статусы модулей (§4 и MODULES_CATALOG)

| Статус | Критерий |
|--------|----------|
| **PLANNED** | Нет API или только заглушка без UAT |
| **MVP** | Happy-path API + минимальный UI + `[x]` в DELIVERY (если модуль в scope релиза) |
| **DONE** | MVP + `TZ.md` синхронизирован + шаг в `UAT-SMOKE.md` + curl в [SMOKE_ALL_SERVICES.md](./SMOKE_ALL_SERVICES.md) (если user-facing) + PRD §4 обновлён |
| **DEFERRED** | Явный `[-]` или out-of-scope в DELIVERY |

Каталог **не опережает** PRD: после каждой фазы — PRD §4 → [MODULES_CATALOG.md](./MODULES_CATALOG.md).

## Как писать в документах

| Ситуация | Формулировка |
|----------|----------------|
| Уже в проде / MVP | Модуль **M7**, статус **MVP**; в DELIVERY — `[x]` без пометки волны. |
| Запланировано | Статус **PLANNED (v1.1)** или **DEFERRED (v2.0)**; в DELIVERY — секция `## Planned — v1.1` с `[ ]`. |
| Исследование | Папка [`ERPs/`](../ERPs/) — справочник отраслей, не имя релиза. |

## Запрещённые в новых правках (для v1.0 scope)

- `W1-E`, `W2-E`, `Gemini`, `enrichment wave`, `SP7`, `SP8`, `Wave D` / `Wave F` в описании **уже сданного**.
- Колонка «Gemini» в таблицах — заменить на **Source** (`ERPs/03 §6`) или убрать.
- **M-коды (M1–M23)** в UI, pricing storefront, sidebar labels — только human names и `hotel_*` / `industry_*` keys; M-коды — appendix PRD only.

## Исключения

- **Технические** идентификаторы в коде/CI (миграции, ветки) не переименовываем.
- **Nafta / hotel** внутренние имена файлов (`doc/nafta/`) — доменный пакет, не продуктовая версия.
- **CP-B2** … **CP-B8** в PLATFORM_ADDONS — CP-B2 Live (v1.0); CP-B3–B8 **Live** (v2.0 shipped).

## Связанные документы

- [MODULES_CATALOG.md](./MODULES_CATALOG.md)
- [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)
- [IMPLEMENTATION_PLANS.md](./IMPLEMENTATION_PLANS.md) — индекс v1.1 · v2.0 · pre-GA · modules
- [SATELLITE_DOCUMENTATION.md](./SATELLITE_DOCUMENTATION.md) § Release phases
