# Product versioning (ERA ecosystem)

Единые правила для PRD, DELIVERY, MODULES_CATALOG, roadmap и smoke-доков.

## Версии

| Версия | Смысл |
|--------|--------|
| **v1.0** | Текущий релиз: всё со статусом **MVP** / **DONE** в `PRD.md` §4 и `[x]` в DELIVERY. В тексте **не** пишем старые коды волн (W1, W2, SP, Gemini, Wave A–F). |
| **v1.1** | Следующий инкремент: отраслевые модули из [MODULES_CATALOG § Planned v1.1](./MODULES_CATALOG.md#planned-v11). |
| **v2.0** | Крупные интеграции и платформа: fiscal/KKM, EDI, TecDoc, Gantt/CDE, platform add-ons **Live**, offline и т.п. — [MODULES_CATALOG § Planned v2.0](./MODULES_CATALOG.md#planned-v20). |

## Как писать в документах

| Ситуация | Формулировка |
|----------|----------------|
| Уже в проде / MVP | Модуль **M7**, статус **MVP**; в DELIVERY — `[x]` без пометки волны. |
| Запланировано | Статус **PLANNED (v1.1)** или **DEFERRED (v2.0)**; в DELIVERY — секция `## Planned — v1.1` с `[ ]`. |
| Исследование | Папка [`ERPs/`](../ERPs/) — справочник отраслей, не имя релиза. |

## Запрещённые в новых правках (для v1.0 scope)

- `W1-E`, `W2-E`, `Gemini`, `enrichment wave`, `SP7`, `SP8`, `Wave D` / `Wave F` в описании **уже сданного**.
- Колонка «Gemini» в таблицах — заменить на **Source** (`ERPs/03 §6`) или убрать.

## Исключения

- **Технические** идентификаторы в коде/CI (миграции, ветки) не переименовываем.
- **Nafta / hotel** внутренние имена файлов (`doc/nafta/`) — доменный пакет, не продуктовая версия.
- **CP-B2** … **CP-B8** в PLATFORM_ADDONS — коммерческие пакеты; для v1.0 MVP API помечаем «MVP», для цели **Live** — **v2.0**.

## Связанные документы

- [MODULES_CATALOG.md](./MODULES_CATALOG.md)
- [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)
- [SATELLITE_DOCUMENTATION.md](./SATELLITE_DOCUMENTATION.md) § Release phases
