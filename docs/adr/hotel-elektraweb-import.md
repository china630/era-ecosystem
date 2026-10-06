# ADR: Elektraweb Excel import (hotel satellite bootstrap)

**Status:** Accepted  
**Date:** 2026-06-12 (amended 2026-10-04: revenue adapter, sell path, ops wipe)  
**Scope:** `era-hotel-pms` — one-time / repeat hotel migration from Elektraweb `.xlsx` exports

## Context

Nafta and future ERA hotel customers may migrate from **Elektraweb** (Eptera). Elektraweb exposes master data and historical operational rows as Excel downloads (~13 template types per property). ERA Hotel PMS needs a **repeatable**, **idempotent** import path that:

- Does not duplicate finance GL (Chart of Accounts stays in `era-finance-core`).
- Respects person identity boundaries (MDM / global citizens vs operational `Guest` profile).
- Can be reused for **each new hotel deployment** without rewriting scripts.
- Is safe in production: bulk write is not exposed to hotel staff during early rollout.

Stage 26 implemented the import engine, schema extensions, reference seed, API, and a phased wizard UI.

## Decision

### 1. Reusable engine + per-entity adapters (not a monolithic script)

- **Parser:** `xlsx` → row objects (`src/lib/import/excel.ts`).
- **Runner:** header alias map → Zod validation → adapter `upsert` per row (`run-import.ts`).
- **Adapters:** one file per entity under `src/lib/import/adapters/*.ts`.
- **Idempotency:** natural keys (`code`, `roomNumber`) or Elektraweb external IDs (`externalRef` on Guest / Reservation / FolioCharge).

Each adapter owns column mapping and link resolution (e.g. Reservation → RoomType by code/name).

### 2. Single UI hub with phased checklist (not Import on every admin screen)

All migration uploads happen at **`/admin/import`** via `ImportWizard` + `ImportStepRow`:

| Phase | Strict order | Entities |
|-------|--------------|----------|
| 1 — Dictionaries | No | revenue-codes, bed-types, room-views |
| 2 — Master | Yes (top → bottom) | room-types → rate-plans → rooms → agencies → product-cards → stock-cards |
| 3 — Transactional | Yes | guests → reservations → folios |

Progress is stored in browser `localStorage` (`era-hotel-import-wizard-v1`) for operator convenience; server has no migration session state.

**Rationale:** scattered Import buttons on master-data / stock / agencies caused order confusion. Verification after import still uses normal CRUD screens; upload is centralized.

### 3. Access control — platform super-admin only (v1)

- **UI:** nav item and wizard visible when `GET /api/auth/me` returns `isPlatformSuperAdmin: true`.
- **API:** `GET /api/import`, `POST /api/import/[entity]` call `assertPlatformSuperAdminImport()` — email/login matched against `PLATFORM_SUPER_ADMIN_EMAILS` (same env as Orchestrator / Finance).
- **Hotel roles** (`Hotel_Admin`, `Manager`, …) do **not** get import API access in v1.

**Future (planned, not implemented):** grant the same wizard to **organization owners** via Orchestrator entitlement (e.g. `hotel_migration` SKU or `hotel_setup` + audit log). Engine and adapters unchanged; only auth gate and optional org-scoped audit.

**Implemented (2026-06-16):** `hotel_migration_pro` entitlement + `Hotel_Admin`/`DIRECTOR`/`OWNER`/`MANAGER` roles; audit via `SatelliteAuditLog` on each import POST.

### 4. Guest import and MDM

- Operational model remains **`Guest`** in hotel DB (visits, folio links, VIP flags) — **no new guest table**.
- Canonical PII lives in **MDM** (`GlobalNaturalPerson` in orchestrator). Guest import calls `resolvePersonIdentity` when FIN/passport present and sets `Guest.globalPersonId`.
- Elektraweb `Guest Id` → `Guest.externalRef` for idempotent historical upsert.

### 5. Explicit exclusions

| Elektraweb export | ERA handling |
|-------------------|--------------|
| Chart of Accounts | **Not imported** — finance-core / GL boundary |
| Users / RBAC | Local satellite users + SSO; separate provisioning |
| HR / payroll | Finance-core |

### 6. Reference seed vs property import

- **`npm run db:seed:reference`** — universal dictionaries (RevenueCode, BedType, RoomView) for **all** deployments; idempotent, no wipe.
- **Wizard import** — property-specific rows from Elektraweb exports (room types, rooms, agencies, historical guests, etc.).

### 7. One revenue adapter for Excel import and the live bridge (2026-10-04)

Elektraweb revenue names and codes map to ERA `RevenueCode` through **one** resolver: `src/lib/integration/elektraweb-revenue.ts`. There is no separate Elektra mapping table.

| Caller | Use |
|--------|-----|
| `revenue-codes` adapter (`#03`) | `upsertElektraRevenueCode` — writes `name` + `taxTag` only |
| `folios` adapter (`#13`) | `resolveElektraRevenueCodeId` — dry run is lookup-only (`createMissing: false`) |
| Live bridge `upsert-folio.ts` | `resolveRevenueCodeId` → same resolver (`REVENUE` / `REVID_REVENUENAME`, `REVCODE`, `REVID`) |

Resolution order:

1. Known pairs → canonical ERA code: accommodation → `ROOM`; banquet / banket / ziyafet / банкет (codes `BNQ`, `BQT`) → `BANQUET`; minibar → `MINIBAR`; laundry → `LAUNDRY`.
2. Elektra code present → same code, uppercased, no prefix (Excel `#03` and folio rows land on one row).
3. Numeric revenue id only → `EW-{id}`; name only → `EW-{slug}`; nothing → `ROOM`.

For non-canonical targets the resolver first reuses an existing row by name (case-insensitive) or by any candidate code, then upserts the target. Re-import never duplicates a revenue code that the operator already renamed in MD-04.

### 8. A channel is not a rate plan (2026-10-04)

Elektraweb rate codes such as `BOOKING`, `EXPEDIA`, `AGODA`, `AIRBNB` describe **where** the room was sold. In ERA that is `Reservation.sourceId` (BookingSource `OTA`) plus `Reservation.agencyId` (the channel agency). The price comes from the **BAR** rate plan.

One resolver, `src/lib/integration/elektraweb-sell-path.ts`, serves both paths:

| Caller | Use |
|--------|-----|
| `rate-plans` adapter (`#05`) | `upsertElektraRateCode` — channel rows are **skipped** as rate plans; the OTA source and channel agency are ensured instead |
| `reservations` adapter (optional `Rate Code` column) + live bridge `upsert-reservation.ts` (`RATECODE`) | `resolveElektraSellPath` → `{ ratePlanId, sourceId, agencyId }`; no rate code → BAR |

- Channel detection uses `isOtaAgency` keywords; `BAR`, `BAR-*` and `PKG*` codes are protected and always stay rate plans.
- The row's own agency wins over the channel agency. An existing reservation `sourceId` is never overwritten.
- Existing databases imported before this decision: `scripts/ops/reclass-elektra-rate-channels.ts --org=<uuid> [--dry-run]` moves reservations and stay slices from channel plans onto BAR + OTA source + channel agency and retires the channel plan (`active=false`). Folio totals are not recalculated.

### 9. Operational wipe for re-import (2026-10-04)

Variant A re-import (keep master data, reload operations) is exposed as a **platform super-admin** screen `/settings/ops-wipe` (`GET|POST /api/admin/ops-wipe`) over the same service as the CLI `scripts/ops/wipe-hotel-ops-transactional.ts` (`src/lib/services/ops-wipe.service.ts`).

- The org comes from the session only; the POST body must repeat the session org id and the phrase `WIPE` (409 on mismatch). It never wipes all tenants.
- The screen shows counts first; deletion is a separate confirm. One bucket: guests, reservations, folios (charges, payments, settlements, deposits, fiscal docs), notes, concierge orders, banquet events, medical orders/alerts, Elektraweb folio outbox — plus rows that cascade from them (procedure appointments, lab results, tour bookings, transfer orders, migration registrations, tourism tax submissions), which the screen also counts. Each counted row is a checkbox. Unchecking a child clears every parent it references (`normalizeWipeSelection`); the server reapplies that rule. Rows without a checkbox (settlements, stays, party, deposits, fiscal docs) go out with the folio or reservation. Rooms return to `AVAILABLE` when reservations are wiped. The CLI with no selection still wipes the whole bucket.
- Master data, finance-core and MDM are untouched. Each wipe writes a `SatelliteAuditLog` entry (`OpsWipe` / `WIPE`).

## Consequences

### Positive

- Second hotel onboarding reuses the same tool; differences are adapter column tweaks, not new pipelines.
- Dry-run preview per file before write reduces production accidents.
- Idempotent upsert allows re-upload after fixing source Excel or adapter mapping.

### Negative / limits

- Import runs **row-by-row** without a single global DB transaction; partial success is possible (errors reported per Excel row).
- Folio import writes charges directly (not through live folio posting APIs) to avoid side effects on bulk historical load.
- Wizard progress in `localStorage` is per-browser, not shared across operators.
- Column headers assume Nafta/Elektraweb export layout; other properties may need adapter alias updates.

## References

- Operator guide: [era-hotel-pms/doc/ELEKTRAWEB-IMPORT.md](../../era-hotel-pms/doc/ELEKTRAWEB-IMPORT.md) — §15 pre-merge scripts, Folio vs ProFolio; **§4.1 shared twin**
- Shared twin canon (EW cutover): [hotel-shared-twin-assignment.md](./hotel-shared-twin-assignment.md)
- **Live dual-run (post-Excel):** [hotel-elektraweb-live-bridge.md](./hotel-elektraweb-live-bridge.md) · [ELEKTRAWEB-LIVE-BRIDGE.md](../../era-hotel-pms/doc/ELEKTRAWEB-LIVE-BRIDGE.md)
- Deferred checkout (T-room): [hotel-deferred-corporate-checkout.md](./hotel-deferred-corporate-checkout.md)
- Delivery: [era-hotel-pms/doc/DELIVERY.md](../../era-hotel-pms/doc/DELIVERY.md) Stage 26
- Module map: [era-hotel-pms/.cursor/rules/hotel-import-module.mdc](../../era-hotel-pms/.cursor/rules/hotel-import-module.mdc)
- Migration SQL: `era-hotel-pms/prisma/migrations/20260612200000_elektraweb_import/`
- Merge scripts: `era-hotel-pms/scripts/merge-guest-cards.js`, `merge-reservations.js`, `merge-folio-transactions.js`
