# Elektraweb import — UI / API / CRUD audit

> **Related:** [ELEKTRAWEB-IMPORT.md](./ELEKTRAWEB-IMPORT.md) §3.4 verify-after-import  
> **Last reviewed:** 2026-06-12 (edit modals + table filters for import verify screens)

This matrix tracks whether each importable entity has **list UI**, **create/update API**, and **form fields** aligned with import/schema.

Legend: ✅ OK · ⚠️ partial · ❌ missing · ➖ N/A (import-only / ops elsewhere)

---

## Summary

| Entity | List UI | Create | Update | Retire | Hard delete | Notes |
|--------|---------|--------|--------|--------|-------------|-------|
| RevenueCode | ✅ | ✅ | ✅ | ✅ `active` | ❌ | PATCH + edit modal |
| BedType | ✅ | ✅ | ✅ | ✅ `active` | ❌ | |
| RoomView | ✅ | ✅ | ✅ | ✅ `active` | ❌ | |
| RoomType | ✅ | ✅ | ✅ | ✅ `active` | ❌ | |
| RatePlan | ✅ | ✅ | ✅ | ✅ `active` | ❌ | |
| Room | ✅ | ✅ | ✅ | ✅ `disabled`/`deleted` | ❌ | rack excludes deleted/disabled |
| Agency | ✅ | ✅ | ✅ | ✅ `active` | ❌ | |
| Product | ✅ | ✅ | ✅ | ✅ `active` | ❌ | |
| Guest | ✅ | ✅ | ✅ | ➖ | ❌ | no profile delete |
| Reservation | ✅ | ✅ | ✅ | status | ❌ | cancel, not delete |
| FolioCharge | ➖ | ✅ | void | ➖ | ⚠️ open folio only | ops reversal, not retire |

**Policy ADR:** [docs/adr/hotel-master-data-retire-policy.md](../../../docs/adr/hotel-master-data-retire-policy.md)

---

## Per-entity detail

### Phase 1 — Dictionaries

#### RevenueCode

| Check | Status | Location |
|-------|--------|----------|
| List + filter | ✅ | `/admin/master-data` — code/name search |
| API GET/POST/PATCH | ✅ | `/api/master/revenue-codes`, `[id]` |
| Modal fields | ✅ | code, name, taxTag, targetFolioType |
| Import fields | ✅ | code, name, taxTag |

#### BedType

| Check | Status | Location |
|-------|--------|----------|
| List + filter | ✅ | `/admin/master-data` → Dictionaries |
| API GET/POST/PATCH | ✅ | `/api/master/bed-types`, `[id]` |
| Modal fields | ✅ | code, name, systemType |
| Import fields | ✅ | code, name, systemType |

#### RoomView

| Check | Status | Location |
|-------|--------|----------|
| List + filter | ✅ | `/admin/master-data` → Dictionaries |
| API GET/POST/PATCH | ✅ | `/api/master/room-views`, `[id]` |
| Modal fields | ✅ | code, name |
| Import fields | ✅ | code, name |

---

### Phase 2 — Master

#### RoomType

| Check | Status | Location |
|-------|--------|----------|
| List + filter | ✅ | `/admin/master-data` |
| API GET/POST/PATCH | ✅ | `/api/master/room-types`, `[id]` |
| Modal fields | ⚠️ | code, name, baseQuota, adultCapacity (no childCapacity) |
| Import fields | ✅ | code, name, baseQuota, adultCapacity |

**Backlog:** childCapacity in form; dynamic quota from room count.

#### RatePlan

| Check | Status | Location |
|-------|--------|----------|
| List + filter | ✅ | `/admin/master-data` |
| API GET/POST/PATCH | ✅ | `/api/master/rate-plans`, `[id]` |
| Modal fields | ⚠️ | code, name, pricePerNight, roomTypeId, medicalFlag — **no** BASE/DERIVED (Stage 25) |
| Import fields | ⚠️ | import sets DERIVED + price 0; UI still legacy |

**Backlog:** dynamic rate plan admin (BAR calendar, derivation).

#### Room

| Check | Status | Location |
|-------|--------|----------|
| List + filter | ✅ | `/admin/master-data` — room number search + room type filter |
| API GET/POST/PATCH | ✅ | `/api/rooms`, `[id]` |
| Create/edit modal | ✅ | roomNumber (immutable on edit), roomTypeId, floor, view/bed codes, location, maxBed |
| Import fields | ✅ | all soft-ref columns |

#### Agency (Travel Agencies)

| Check | Status | Location |
|-------|--------|----------|
| List + filter | ✅ | `/admin/travel-agencies` — code/name + active filter |
| API GET/POST (upsert) | ✅ | `/api/admin/travel-agencies` |
| Modal | ✅ | code, name, voen, commissionPercent, active |
| Import fields | ⚠️ | import has phone/email — **not** on Agency model |

**Backlog:** phone/email columns if needed from Elektraweb.

#### Product (Product Cards + Stock Cards)

| Check | Status | Location |
|-------|--------|----------|
| List + filter | ✅ | `/admin/stock` — code/name + SELLABLE/STOCK filter |
| API GET/POST/PATCH | ✅ | `/api/stock/products`, `[id]` |
| Create/edit modal | ✅ | code, name, productType, unit, price, vatRate, active (edit) |
| Receipt (stock qty) | ✅ | separate modal → `/api/stock/movements` |
| Import fields | ⚠️ | revenueGroup, lastCost, lastVendor — import only |

**Backlog:** product group picker; import-only cost fields in UI.

---

### Phase 3 — Transactional

#### Guest

| Check | Status | Location |
|-------|--------|----------|
| List + filter | ✅ | `/guests` — name, phone, FIN, passport |
| API GET/POST | ✅ | `/api/guests` |
| API PATCH | ✅ | `/api/guests/[id]/full` |
| UI | ✅ | GuestCardModal (rich CRM fields) |
| MDM | ✅ | globalPersonId via person lookup + import resolve |
| Import | ✅ | externalRef + operational fields |

Import is **wizard-only** (super-admin); daily ops use Guest Card.

#### Reservation

| Check | Status | Location |
|-------|--------|----------|
| List | ✅ | `/reports/reservations`, chessboard, room plan |
| API | ✅ | create/edit via ReservationCardModal → `/api/reservations/*` |
| Import | ✅ | externalRef upsert |

No dedicated “reservations admin grid” — by design (FO workflows).

#### FolioCharge

| Check | Status | Location |
|-------|--------|----------|
| List per folio | ✅ | folio tab in reservation card / `/folio/[id]` |
| API post charge | ✅ | `POST /api/folios` |
| API void | ✅ | `POST /api/folios/charges/[id]/void` |
| Import | ✅ | bulk historical via wizard (bypasses postCharge) |

No standalone “all folio charges” report for imported history — use folio on reservation.

---

## Explicitly out of scope

| Item | Reason |
|------|--------|
| Chart of Accounts | finance-core |
| Import UI on CRUD screens | centralized `/admin/import` only |
| Hard DELETE on master dictionaries | [retire policy ADR](../../../docs/adr/hotel-master-data-retire-policy.md) — use `active` or room `deleted`/`disabled` |

---

## Verification checklist (after import)

1. `/admin/master-data` — filter and edit revenue codes, bed types, room views, room types, rate plans, rooms.
2. `/admin/travel-agencies` — filter by code/name/active; edit agency.
3. `/admin/stock` — filter SELLABLE vs STOCK; edit product.
4. `/guests` — filter by name/phone/FIN; open card for MDM link.
5. `/reports/reservations` — imported reservations visible.
6. Open reservation → folio — imported charges if folios step completed.

---

## Change log

| Date | Change |
|------|--------|
| 2026-06-12 | Initial audit; added BedType/RoomView API+UI, room create, product create, agency modal |
| 2026-06-12 | PATCH APIs + edit modals for all master entities; table filters on verify screens |
| 2026-06-12 | Retire policy ADR; `active` on dictionaries; room inventory flags; ops guards |
