# ADR: Hotel PMS — master data retire policy (no hard delete)

**Status:** Accepted  
**Date:** 2026-06-12  
**Scope:** `era-hotel-pms` master dictionaries, inventory, import verify screens

## Context

Elektraweb migration and daily ops need a consistent way to **remove** master rows from active use without breaking reservations, folio history, or idempotent import keys (`code`, `externalRef`). Hard `DELETE` on referenced rows is unsafe.

## Decision

Use **entity-specific retire strategies**. No `DELETE` HTTP routes on master/import verify entities.

| Entity | Strategy | Flag(s) | Hard delete | Notes |
|--------|----------|---------|-------------|-------|
| **RevenueCode** | Retire | `active` | Forbidden | Referenced by `FolioCharge`, rate packages, add-ons. Retired codes stay for posted charges; hidden from new charge pickers. |
| **BedType** | Retire | `active` | Forbidden | Soft string ref on `Room.bedTypeCode`; code must remain stable. |
| **RoomView** | Retire | `active` | Forbidden | Soft string ref on `Room.viewCode`. |
| **RoomType** | Retire | `active` | Forbidden | FK from `Room`, `Reservation`. Retire when no longer sold; existing bookings keep FK. |
| **RatePlan** | Retire | `active` (existing) | Forbidden | FK from `Reservation`. Import sets `active: true`; UI may deactivate. |
| **Room** | Inventory soft state | `deleted`, `disabled` (existing) | Forbidden | Elektraweb parity. `deleted` = out of inventory permanently; `disabled` = temporarily unavailable. |
| **Agency** | Retire | `active` (existing) | Forbidden | Import maps Passive / Is Deleted → `active: false`. |
| **Product** | Retire | `active` (existing) | Forbidden | Stock history via `StockMovement`; deactivate SKU. |
| **Guest** | No delete | `isLocked`, CRM flags | Forbidden | Profile retained for reservation/MDM history. |
| **Reservation** | Status lifecycle | `status` (CANCELLED, …) | Forbidden | Not a dictionary. |
| **FolioCharge** | Operational void | — | Allowed on **open** folio only | Reversal of same-day ops; emits void event. Not master-data retire. |

### Rules

1. **Natural keys are immutable** after create (`code`, `roomNumber`, `externalRef`). Retire, do not rename keys to “free” them.
2. **Import upsert** may refresh names/attributes and **may set retire flags** when source file carries them (agency passive, room deleted). Re-import must not silently re-activate unless source says so.
3. **Reference seed** (`db:seed:reference`) upserts core codes with `active: true` on create; update path must not force re-activation of manually retired rows.
4. **New operational use** (reservation create, folio charge, room assignment) must reject retired/inventory-out rows.
5. **Admin verify screens** show all rows with filters (active / inactive / deleted); operational pickers use active inventory only.

## Implementation map

| Layer | Location |
|-------|----------|
| Policy helpers | `src/lib/master-data/retire-policy.ts` |
| Services | `master-data.service.ts`, `room.service.ts`, guards in `folio.service.ts`, `reservation.service.ts` |
| API | PATCH on `[id]` routes — `active` / `disabled` / `deleted`; no DELETE |
| UI | `/admin/master-data`, `/admin/stock`, `/admin/travel-agencies` — retire toggles + filters |
| Docs | [ELEKTRAWEB-IMPORT-UI-AUDIT.md](../../era-hotel-pms/doc/ELEKTRAWEB-IMPORT-UI-AUDIT.md) |

## Consequences

- Schema migration adds `active` to `RevenueCode`, `BedType`, `RoomView`, `RoomType`.
- Slightly wider admin tables (status column).
- Future dynamic rate plan UI inherits `active` on `RatePlan`.

## Alternatives considered

- **Hard delete with FK cascade** — rejected; destroys folio/reservation integrity.
- **Single `deletedAt` on all tables** — rejected; room inventory needs `disabled` vs `deleted`; dictionaries only need boolean `active`.
