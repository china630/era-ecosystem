# POS bridge (era-hotel-pms ↔ era-fb-pos)

Phase 2 Stage 14 — **lite bridge** in the satellite PMS. Full floor plan, KDS, and POS Z-shift live in `era-fb-pos` (Stage 16+).

Архитектурные решения Nafta и матрица «PMS vs ERP» — [13-nafta-validation-checklist.md](13-nafta-validation-checklist.md) §H.

---

## Термины

| Термин | Значение |
|--------|----------|
| **POS** | Point of Sale — касса точки продаж (ресторан, бар, SPA-касса, терминал). **Не** отдельный модуль «магазин» в нашей архитектуре. |
| **era-fb-pos** | Сателлит **F&B** = **Food & Beverage** POS: зал, меню, чеки, KDS, смена официанта. Ресторан в отеле и **вне** отеля. |
| **Quick posting** | WA0135 в PMS — быстрое начисление на folio (FOOD, SPA, …) **без** карты зала. |
| **STOCK** | Склад/закупки — **ERA Finance / ERP**, не операционный учёт в `era-hotel-pms`. |

Спека модулей: [15-pos-fb-spa.md](15-pos-fb-spa.md).

---

## Два слоя: операции vs учёт

```
┌─────────────────────────────────────────┐
│  era-hotel-pms (слой A)                 │
│  folio, in-house, check-out, night audit │
└──────────────────┬──────────────────────┘
                   │ room-charge, события E1–E7
┌──────────────────▼──────────────────────┐
│  ERA Finance / 1C (слой B)              │
│  GL, склад, e-qaimə, фискал submission   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  era-fb-pos (будущее)                   │
│  чеки, зал, KKM на месте                │
└──────────────────┬──────────────────────┘
         «на номер» ──► room-charge ──► PMS folio
         walk-in / вне отеля ──► только ERP (+ KKM)
```

**Вывод:** `era-fb-pos` как независимый сателлит **не заменяет** связь с PMS для продаж **на номер** — иначе баланс folio и night audit не сходятся. В финядро события уходят **в дополнение**, не вместо PMS.

---

## Матрица интеграций

| Сценарий | hotel-pms | era-fb-pos | ERA Finance |
|----------|-----------|------------|-------------|
| Ресторан в отеле, **на номер** | **Обязательно** (`room-charge`) | Источник чека | Да |
| Ресторан в отеле, оплата на месте | Опционально | Да | Да (KKM) |
| Ресторан **вне отеля** | Нет | Да | Да |
| SPA-товар с ресепшена (нет SPA-кассы) | **Quick posting** | — | Да |
| Бронь SPA-кабинета (слот) | **Календарь** `/pos/calendar` | Позже | — |
| Мед. санаторий (пакет в номере) | **Медконтур**; folio только **доплаты** | — | Да |
| Склад, рецептуры | Нет | Нет (или ERP) | **Да** |

---

## SPA внутри отеля

Пока у Nafta **нет** полноценной SPA-кассы (чеклист A1):

1. **Quick posting** в PMS — оставляем для продаж на folio in-house.
2. **Medical** — процедуры, alerts; начисления вне пакета номера — MED-04.
3. **POS calendar** в PMS — слоты (кабинет), не касса.

Отдельный сателлит **era-spa-pos** для санатория **не планируем** без нового scope: медицина уже в hotel-pms; услуги по гипотезе **включены в оплату номера** (см. чеклист D3). Отдельный SPA-сателлит — только если появится стойка SPA с KKM и меню как в ресторане; тогда сначала рассмотреть **outlet SPA в era-fb-pos**.

---

## Room charge (G2-3)

`POST /api/pos/room-charge`

**Auth:** session with `POS_POST`, or header `Authorization: Bearer <POS_BRIDGE_SECRET>` (see `.env.example`).

**Body:**

| Field | Required | Notes |
|-------|----------|-------|
| `reservationId` | one of | In-house reservation |
| `roomNumber` | one of | Resolves active `IN_HOUSE` stay |
| `revenueCode` | yes | Master code, e.g. `FOOD`, `SPA` |
| `amount` | yes | AZN, > 0 |
| `description` | yes | Folio line text |
| `outletCode` | no | Audit / reporting |
| `productSku` | no | Deprecated for Nafta: stock in ERP; flag `STOCK_CONSUMPTION_ENABLED` only for dev/MVP |

**Rules:** reservation `IN_HOUSE`, target folio `OPEN`, revenue code must exist. Posts via `postCharge` and emits `SATELLITE_HOTEL_FOLIO_CHARGE_POSTED` when enabled.

**Test:** Admin → Integration → “POS bridge test”, or curl with bridge secret.

---

## Resource calendar (POS-01…03)

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/pos/resources` | Tables / spa cabins |
| GET/POST | `/api/pos/reservations` | Slot bookings |
| UI | `/pos/calendar` | Day × resource grid |

Optional link to PMS `reservationId` or free-text `guestName`.

---

## Night audit

`PosBridgeShift` OPEN blocks night audit (Stage 17). fb-pos reports via `PUT /api/pms/pos-shift-status`.

---

## OpenAPI и wireflow

| Артефакт | Путь |
|----------|------|
| OpenAPI 3.0 (implemented + planned) | [fb-pos-pms-bridge.yaml](../openapi/fb-pos-pms-bridge.yaml) |
| Wireflow room charge | [09-wireflow-ticket-to-folio.md](../../era-fb-pos/doc/09-wireflow-ticket-to-folio.md) |
| Wireflow cash/card (без PMS) | [10-wireflow-cash-fiscal.md](../../era-fb-pos/doc/10-wireflow-cash-fiscal.md) |
| PMS bridge tasks | [DELIVERY.md](../DELIVERY.md) Stage 17 |
| Umbrella monorepo | [MONOREPO.md](../MONOREPO.md) |

---

## Related

- Spec index: [15-pos-fb-spa.md](15-pos-fb-spa.md)
- Outbound folio events: [22-outbound-integration-policy.md](22-outbound-integration-policy.md)
- Finance boundary: [01-finance-boundary.md](01-finance-boundary.md)
