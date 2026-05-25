# ERA F&B POS — Product Requirements Document (PRD)

> Ресторанный сателлит: зал, кухня, смена POS, оплата, room charge → **era-hotel-pms**.  
> Детальная спека: [doc/README.md](./doc/README.md) · DELIVERY: [doc/DELIVERY-FB.md](./doc/DELIVERY-FB.md) · PMS bridge: [era-hotel-pms/doc/openapi/fb-pos-pms-bridge.yaml](../era-hotel-pms/doc/openapi/fb-pos-pms-bridge.yaml)

| Параметр | Значение |
|----------|----------|
| **Продукт** | ERA F&B POS (`era-fb-pos`) |
| **Host** | `pos.era.az` (3200) |
| **Entitlement** | Hotel bundle / restaurant add-on (не `industry_*` sidebar) |
| **Пилот** | Nafta (ресторан при отеле) |

---

## §1. Vision

### 1.1. Проблема

Операции ресторана (стол, заказ, кухня, смена кассира) не должны жить в PMS или ERP. PMS — проживание и folio; ERP — GL и склад. Смешение приводит к ошибкам night audit и двойному учёту.

### 1.2. Решение

**era-fb-pos** — облачный F&B POS: floor map, ticket, KDS, payments, Z-close. Оплата «на номер» — `POST /api/pms/room-charge` в hotel-pms. Склад и выручка GL — события в Finance через цепочку PMS/ERP.

### 1.3. Принципы (не нарушать)

1. Операции зала — **только fb-pos**
2. Folio, check-out, night audit — **только hotel-pms**
3. GL, Product, Recipe — **Finance**
4. KKM на месте; e-qaimə — Finance compliance

Полная матрица: [doc/00-vision-and-boundaries.md](./doc/00-vision-and-boundaries.md)

### 1.4. Out-of-scope v1

- PMS chessboard, medical, SPA POS
- Локальный склад и GL
- Dark kitchen / агрегаторы доставки
- Полный клон iiko/rKeeper

---

## §2. Benchmark reference

| Бенчмарк | Регион | Что заимствуем |
|----------|--------|----------------|
| **Poster POS** | CIS | Floor, быстрый заказ, простой KDS |
| **iiko** | CIS/RU | Kitchen stations, modifiers |
| **Toast** | Global UX | Ticket flow, payment UX |
| **R-Keeper** | CIS legacy | Room/hotel charge patterns (concept) |
| **ElektraWeb F&B** | TR/AZ ref | Паритет операций зала, не клон UI |

---

## §3. Personas & roles

> RBAC: [docs/SATELLITE_DOCUMENTATION.md](../docs/SATELLITE_DOCUMENTATION.md) § Identity & RBAC.

| Роль | Код | Описание |
|------|-----|----------|
| Владелец бизнеса | `BUSINESS_OWNER` | Маппинг `OWNER`/`DIRECTOR`; биллинг — Finance / hotel org |
| Официант | `FB_WAITER` | Заказы, оплата |
| Повар / бар (KDS) | `FB_KITCHEN` |
| Менеджер зала | `FB_MANAGER` |
| Хостес | `FB_HOST` (optional FB-2) |

---

## §4. Modules

| ID | Module | Benchmark | Status | Integration |
|----|--------|-----------|--------|-------------|
| M0 | Shell, nav, design-system | Toast | **IN_PROGRESS** | — |
| M1 | Outlet, tables, menu admin | Poster | **PLANNED** | — |
| M2 | Floor map + ticket | Poster | **PLANNED** | — |
| M3 | KDS fire/done | iiko KDS | **PLANNED** | — |
| M4 | Payments cash/card | Toast | **PLANNED** | KKM mock |
| M5 | Room charge | R-Keeper+PMS | **PLANNED** | PMS Stage 17 API |
| M6 | POS shift X/Z | 1C Z-report | **PLANNED** | PMS `pos-shift-status` |
| M7 | Void / discount | Toast | **PLANNED** | — |
| M8 | Split bill | Toast | **DEFERRED** | FB-2 |
| M9 | ERP consumption E8 | — | **DEFERRED** | Finance event |
| M10 | i18n en/ru/az | hotel-pms | **DEFERRED** | FB-2 |

**PMS dependency:** [era-hotel-pms DELIVERY Stage 17](../era-hotel-pms/doc/DELIVERY.md) — bridge готов.

---

## §5. User stories

| ID | История | Phase | Wireflow |
|----|---------|-------|----------|
| FB-01 | Открыть стол, 2 блюда, fire на кухню | FB-1 | — |
| FB-02 | KDS DONE | FB-1 | — |
| FB-03 | Оплата картой + KKM mock | FB-1 | [10-wireflow-cash-fiscal](./doc/10-wireflow-cash-fiscal.md) |
| FB-04 | Оплата на номер 201 → folio PMS | FB-1 | [09-wireflow-ticket-to-folio](./doc/09-wireflow-ticket-to-folio.md) |
| FB-05 | Void строки (manager) | FB-1 | — |
| FB-06 | Z-close без open tickets | FB-1 | — |
| FB-07 | Open POS shift блокирует NA в PMS | FB-1 | — |
| FB-08 | Split bill | FB-2 | — |
| FB-09 | Бронь стола → ticket | FB-2 | — |
| FB-10 | Consumption → ERP | FB-2 | — |

Критерии G-FB-1…7: [doc/07-phases-delivery-user-stories.md](./doc/07-phases-delivery-user-stories.md)

---

## §6. Integrations

### 6.1. era-hotel-pms (обязательно для hotel mode)

| API | Назначение |
|-----|------------|
| `GET /api/pms/in-house` | Поиск гостя для room charge |
| `POST /api/pos/room-charge` | Idempotent charge на folio |
| `PUT /api/pms/pos-shift-status` | Open/close POS shift → NA guard |

OpenAPI: [fb-pos-pms-bridge.yaml](../era-hotel-pms/doc/openapi/fb-pos-pms-bridge.yaml)

### 6.2. ERA Finance

- Revenue codes `FOOD`, `BAR` — согласование с PMS E5/E1
- E7 payment fiscalized, E8 consumption — Phase 2
- **Не** дублировать invoice MDM

### 6.3. Standalone mode

Ресторан без PMS: cash/card only, без FB-04/FB-07.

---

## §7. Release phases

| Phase | Scope | Status |
|-------|--------|--------|
| **FB-0** | Scaffold, auth, menu seed, PMS client stub | **IN_PROGRESS** |
| **FB-1** | MVP Nafta зал (G-FB-1…7) | **PLANNED** |
| **FB-2** | Split, calendar, real KKM, E8 | **PLANNED** |
| **FB-3** | Multi-outlet, room service | **DEFERRED** |

---

## §8. Changelog

| Date | Note |
|------|------|
| 2026-05 | Initial PRD stub |
| 2026-05-25 | Wave 2: FB-0 auth (FB_WAITER/FB_MANAGER), menu admin, interactive floor/orders/kds UI |
