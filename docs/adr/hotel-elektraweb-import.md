# ADR: Elektraweb Excel import (hotel satellite bootstrap)

**Status:** Accepted  
**Date:** 2026-06-12  
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

- Operator guide: [era-hotel-pms/doc/ELEKTRAWEB-IMPORT.md](../../era-hotel-pms/doc/ELEKTRAWEB-IMPORT.md) — §15 pre-merge scripts, Folio vs ProFolio
- Deferred checkout (T-room): [hotel-deferred-corporate-checkout.md](./hotel-deferred-corporate-checkout.md)
- Delivery: [era-hotel-pms/doc/DELIVERY.md](../../era-hotel-pms/doc/DELIVERY.md) Stage 26
- Module map: [era-hotel-pms/.cursor/rules/hotel-import-module.mdc](../../era-hotel-pms/.cursor/rules/hotel-import-module.mdc)
- Migration SQL: `era-hotel-pms/prisma/migrations/20260612200000_elektraweb_import/`
- Merge scripts: `era-hotel-pms/scripts/merge-guest-cards.js`, `merge-reservations.js`, `merge-folio-transactions.js`
