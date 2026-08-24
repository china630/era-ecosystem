# ADR: Hotel module taxonomy (CP commercial)

## Status

Accepted — 2026-05 (revised 2026-05-31: 9-key consolidation)

## Context

ElectraWeb features were split across 12 fine-grained `hotel_*` keys. Product review grouped them into **9 commercial modules** aligned with operational roles (core PMS, housekeeping, distribution, scheduling, etc.).

ERA CP commercial layers: satellite gate → modules → tiers → platform add-ons ([`CONTROL_PLANE_ARCHITECTURE.md`](../CONTROL_PLANE_ARCHITECTURE.md)).

## Decision

1. **`industry_hotel_pms`** — satellite gate (opens Hotel PMS app).
2. **`hotel_*` keys** in `pricing_modules` — billable functional modules inside the satellite (see table; includes optional Agency Portal SKU).
3. **Legacy key aliases** — dual-read for migration (`hotel_front_office` → `hotel_core`, etc.).
4. **`platform_*`** — word **add-on** in UI/docs only for cross-product services.
5. **Bundles:** City / Resort / Sanatorium use consolidated keys — **`hotel_agency_portal` is not included by default** (sold separately).

## Hotel module keys (canonical)

| Key | Human name | Consolidates (legacy) |
|-----|------------|------------------------|
| `hotel_core` | PMS Core (Front Office, Front Cash, Night Audit) | `hotel_front_office`, `hotel_front_cash`, `hotel_night_audit` |
| `hotel_housekeeping` | Housekeeping & Room Rack | — |
| `hotel_service` | Service & maintenance | — |
| `hotel_migration_pro` | Migration PRO (migration authority submissions) | alias `migration_pro` |
| `hotel_transfers` | Transfers | — |
| `hotel_spa_scheduling` | SPA & Scheduling | — |
| `hotel_distribution` | Distribution (Channel Manager & Contracts) | `hotel_channel_ota`, `hotel_contracts_yield` |
| `hotel_agency_portal` | Agency Portal (B2B extranet) | — |
| `hotel_guest_experience` | Guest Profiles & Tasks | — |
| `hotel_banquets` | Banquets & BEO | — |
| `hotel_medical_sanatorium` | Medical & Sanatorium | — |
| `hotel_setup_advanced` | Advanced master data | — |

See [hotel-agency-portal.md](./hotel-agency-portal.md).

## Consequences

- Orchestrator `/pricing` Hospitality section: gate + hotel submodules + bundles.
- Hotel routes map to required `hotel_*` key via `org-entitlement-gate` / `requireHotelModule`.
- Nav sections in `HotelOpsShell` use section `id` = module key.
- Source of truth: `era-orchestrator/packages/database/prisma/lib/core/hotel-module-keys.ts` (mirrored in `@era/satellite-kit`).
- Guest group tours (`/tours`, HOT-TOUR-01) share **`hotel_transfers`** — do not add a SKU. Spec: [hotel-guest-tours.md](./hotel-guest-tours.md).
