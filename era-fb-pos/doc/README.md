# ERA F&B POS (`era-fb-pos`) — пакет спецификации

> **Статус:** сателлит **era-fb-pos** (код + спека).  
> **Расшифровка:** **F&B** = Food & Beverage · **POS** = Point of Sale.  
> **Не:** универсальный POS для розничных магазинов; **не** замена мед. модуля санатория.

Код: корень репозитория `era-fb-pos/` (Next.js :3200). PMS-мост остаётся в **era-hotel-pms** — см. [08-extraction](08-extraction-to-satellite-repo.md).

---

## Связанные продукты

| Продукт | Роль |
|---------|------|
| **era-hotel-pms** | Бронь, folio, night audit, quick posting (WA0135), **мост** room-charge, календарь слотов (упрощённый) |
| **era-fb-pos** | Ресторан/бар: зал, чеки, KDS, смена POS, меню F&B, оплата, KKM на месте |
| **ERA Finance** | GL, склад, рецептуры, закупки, e-qaimə submission |
| **era-spa-pos** | **Не планируется** для Nafta — см. [13-nafta-validation-checklist.md](../../era-hotel-pms/doc/clone-spec/13-nafta-validation-checklist.md) §H |

Архитектура стыковки: [23-pos-bridge.md](../../era-hotel-pms/doc/clone-spec/23-pos-bridge.md).

---

## Карта документов

| № | Документ | Содержание |
|---|----------|------------|
| 00 | [00-vision-and-boundaries.md](00-vision-and-boundaries.md) | Видение, границы, что в PMS vs fb-pos |
| 01 | [01-architecture-and-integrations.md](01-architecture-and-integrations.md) | Сателлиты, события, контракты |
| 02 | [02-domain-model.md](02-domain-model.md) | Сущности, статусы, жизненный цикл чека |
| 03 | [03-floor-orders-kds.md](03-floor-orders-kds.md) | Зал, заказ, кухня (KDS) |
| 04 | [04-payments-shifts-fiscal.md](04-payments-shifts-fiscal.md) | Оплата, split, X/Z, KKM, room charge |
| 05 | [05-master-data-menu.md](05-master-data-menu.md) | Outlet, меню, модификаторы, маппинг revenue |
| 06 | [06-rbac-and-operations.md](06-rbac-and-operations.md) | Роли, смены, отчёты |
| 07 | [07-phases-delivery-user-stories.md](07-phases-delivery-user-stories.md) | Фазы, US, критерии готовности |
| 08 | [08-extraction-to-satellite-repo.md](08-extraction-to-satellite-repo.md) | Чеклист выноса в `era-fb-pos` |
| 09 | [09-wireflow-ticket-to-folio.md](09-wireflow-ticket-to-folio.md) | Wireflow: стол → KDS → room charge → folio |
| 10 | [10-wireflow-cash-fiscal.md](10-wireflow-cash-fiscal.md) | Wireflow: cash/card + KKM + E3/E7 (без PMS) |
| — | [DELIVERY-FB.md](DELIVERY-FB.md) | Tracker FB-0…FB-3 |
| — | [../openapi/fb-pos-pms-bridge.yaml](../openapi/fb-pos-pms-bridge.yaml) | OpenAPI fb-pos ↔ PMS |
| — | [../MONOREPO.md](../MONOREPO.md) | Umbrella monorepo (рекомендуется) |
| — | [../DOCUMENTATION-INDEX.md](../DOCUMENTATION-INDEX.md) | Реестр всей документации |
| — | [../nafta/supplement-pos-spa.md](../nafta/supplement-pos-spa.md) | Скрины Elektraweb (WA0098, 0135, 0146, 0282) |
| — | [../clone-spec/15-pos-fb-spa.md](../clone-spec/15-pos-fb-spa.md) | Краткий индекс (legacy, ссылка сюда) |

---

## Референс Elektraweb (Nafta)

| WA | Тема | Покрытие в fb-pos |
|----|------|-------------------|
| WA0098 | Настройки POS, X/Z | [04-payments-shifts-fiscal.md](04-payments-shifts-fiscal.md) |
| WA0135 | Quick posting | **Остаётся в hotel-pms** |
| WA0146 | Календарь столов/SPA | PMS: lite; fb-pos: полный при outlet |
| WA0282 | Маппинг SPA/Med продуктов | Revenue codes → ERP (Finance) |

**Нужны доп. скрины** для детализации UI: карта зала, чек официанта, KDS, Z-отчёт, split bill — см. supplement §«Чего не хватает».

---

## Версия

| Версия | Дата | Изменение |
|--------|------|-----------|
| 0.1 | 2026-05 | Первый полный пакет спецификации (без кода) |
| 0.2 | 2026-05 | OpenAPI bridge + wireflow ticket→folio |
| 0.3 | 2026-05 | Wireflow cash, DELIVERY-FB, MONOREPO + DOCUMENTATION-INDEX |
