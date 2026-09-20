# ADR: Hotel Channel Manager pack (OTA hub, direct IBE, contracts)

**Status:** Accepted  
**Date:** 2026-09-20  
**Product:** `era-hotel-pms` + control-plane SKU `hotel_distribution`  
**Amends:** [hotel-ota-adapter-strategy.md](./hotel-ota-adapter-strategy.md) · [hotel-module-taxonomy.md](./hotel-module-taxonomy.md) · [era-commercial-catalog.md](./era-commercial-catalog.md)  
**Related:** [hotel-b2b-sales-contracts.md](./hotel-b2b-sales-contracts.md) · [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md) · [satellite-organization-bind.md](./satellite-organization-bind.md)

## Context

`hotel_distribution` is sold as “Distribution (Channel Manager & Contracts)” at **29 AZN**. Hotels buy a **sales-channel pack**, not a vague “distribution” toggle:

1. **Live OTA** via a channel manager (ARI out, reservations in).
2. **Direct website** — room search + book on the hotel’s own site.
3. **B2B contracts / allotments** — already in this SKU ([hotel-b2b-sales-contracts.md](./hotel-b2b-sales-contracts.md)).

Engineering today:

| Layer | State |
|-------|--------|
| Local CM UI (mappings, stop-sell, journal) | SHIPPED — `HOT-CH-01` |
| Live ARI / OTA | STUB — `HOT-CH-02`; adapters gated by **process env** (`ERA_CHANNEL_ADAPTER`, `EXELY_*`, `BOOKING_COM_*`, `EXPEDIA_*`) |
| Direct IBE | Toy MVP — `GET /api/public/booking/rates` + `/b2c`; **no org**, no inventory, no hold/book |
| Hotel City bundle | **Omits** this SKU (packaging only, not a technical limit) |

Channex.io is the chosen OTA hub (PMS-partner). Live hotel-type property cost to ERA is **USD 7 / property / month** (company COGS). Staging is free. Published ARI cap: **20 calls/min/property** (10 restrictions+prices + 10 availability). Soft caps 20 room types / 200 rate plans per property (vendor overage, not an ERA meter).

Process-level vendor env cannot serve SHARED. Operational settings must not live in satellite `.env`.

## Decision

### 1. One SKU — 39 AZN — City included

- Catalog **key stays** `hotel_distribution` (legacy aliases `hotel_channel_ota` / `hotel_contracts_yield` unchanged).
- List price **39 AZN / month** (palette 29 → 39). Premium stays true.
- Seed / storefront **name:** `Channel Manager (OTA & Direct)`.
- One module, no child SKUs. Entitlement opens all three surfaces:
  - Channel Manager UI + live Channex (when certified / live);
  - Direct IBE API + optional ERA `/b2c` widget;
  - Sales contracts / allotments.
- **Hotel City** includes `hotel_distribution`, same as Resort / Sanatorium. `hotel_agency_portal` stays a separate 39 SKU.
- Do not add a Channex or OTA meter. Rooms capacity meter (4 AZN) is unchanged.
- Channel-manager vendor invoices are **ERA company COGS**. They are not a satellite setting, not an org invoice line, not a QuotaGuard driver.

Indicative bundle list (discount % unchanged; `pricing-catalog-canon.spec.ts` is SSOT):

| Bundle | Change | List |
|--------|--------|------|
| Hotel City | + this SKU at 39 | 126 AZN × 10% → **113.40** |
| Hotel Resort | SKU 29 → 39 | 232 AZN × 15% → **197.20** |
| Hotel Sanatorium | same + medical | 271 AZN × 12% → **238.48** |

### 2. Channex is the production OTA hub

- Production live adapter is **`channex`**. ERA does not run Booking.com / Expedia Connectivity as a second inventory SoT on the same property.
- `stub` = local/dev. `webhook` = cutover bridge only (e.g. Elektraweb), not the long-term hub.
- `exely` / `booking_com` / `expedia` = legacy dry-run; no new process env; never live beside Channex for one org.
- Default Channex `property_type`: **hotel**. Vacation-rental type is explicit opt-in.
- Staging is default. **Live** property only when the org has this SKU, mappings exist, and an entitled admin turns live.
- Production needs Channex **PMS certification** once (Super-Admin `pmsCertified` on `/super-admin/vendors/channex`, not hotel env). Until then `HOT-CH-02` stays **STUB**.
- ARI: queue per `organizationId` + property; **POST `/api/v1/availability`** (room_type_id) and **POST `/api/v1/restrictions`** (rate_plan_id, rate, stop_sell); 10+10 calls/min/property; 429 → `notBefore`; stale PROCESSING reclaim.
- Inbound webhooks: notification `{event, payload:{booking_id, property_id, revision_id}}` → **GET `/booking_revisions/:id`** → ingest → **POST `/booking_revisions/:id/ack`**. Unmapped room/rate UUIDs fail closed (no first-room fallback). Fast 2xx only after ingest.

### 3. Direct IBE uses ERA inventory

Website search **does not** call Channex.

Public API (org from **publishable key / hotel slug**, never process bind):

| Method | Role |
|--------|------|
| `GET /api/public/v1/availability` | Dates + occupancy → room types + BAR (stop-sell, OOO, allotment priority) |
| `POST /api/public/v1/holds` | Short TTL hold |
| `POST /api/public/v1/bookings` | Idempotent book; channel `DIRECT` / `WEB` |
| CORS | Org allowlist |

After direct book: save reservation, enqueue ARI to Channex. Replace or org-scope `/api/public/booking/rates` — no cross-tenant dump.

IBE is not SHIPPED until real availability + idempotent book + isolation tests + UAT evidence.

### 4. No operational settings in satellite env

**Process env:** infrastructure only (`DATABASE_URL`, Redis, JWT, orchestrator URL, platform service tokens).

**Forbidden in satellite env:** adapter choice, vendor property ids, hotel API keys, webhook secrets, IBE origins.

| Secret / setting | SoR |
|------------------|-----|
| ERA partner Channex API key (one key, all properties) | Control-plane vault; satellite reads at runtime — **not** hotel compose |
| Per-org `channexPropertyId`, property_type, live/staging, mappings | Hotel DB (`organizationId`); optional CP org card synced by org id |
| Per-org IBE publishable key, allowed origins | Hotel DB (`organizationId`) |
| Per-org webhook verification | Same — not a process-wide `ERA_OTA_WEBHOOK_SECRET` |

`resolveChannelAdapter(organizationId)` from the org binding. Default = off/stub. SHARED requests never pick the Channex property via `ERA_SATELLITE_ORGANIZATION_ID`.

### 5. Honesty / coverage

| ID | Intent | SHIPPED only when |
|----|--------|-------------------|
| `HOT-CH-01` | Local CM UI | already SHIPPED |
| `HOT-CH-02` | Channex + org binding | certified path + live UAT; else STUB |
| `HOT-IBE-01` | Public v1 availability + book | org isolation + UAT; current rates MVP ≠ SHIPPED |

Product-Readiness for this SKU follows live CM + IBE, not local UI alone. IBE Scaffold ✅ needs a negative path (wrong key, other org, overbook).

## Consequences

- Catalog seed: `name` + `pricePerMonth: 39`; City bundle keys include `hotel_distribution`; storefront i18n (az/en/ru) follows the new name.
- Entitled orgs pick up 39 at next catalog sync (commercial freeze rule).
- Nafta: webhook/Elektra until Channex live; no dual BAR push to Booking and Channex.
- Implementation waves W1–W8: org binding, vault, ARI, webhooks, IBE, certification.

## Out of scope

- Agency Portal (`hotel_agency_portal`).
- Direct Booking.com / Expedia certification.
- Splitting contracts or IBE into another SKU.
- Full branded hotel website (API + thin ERA widget only).
- Vendor overages as ERA meters — cap in ops UI; overage is company COGS or a later quote.

## References

- Channex staging, docs, Channel API, PMS certification (partner mail).
- Runbook: [channex-pms-certification.md](../runbooks/channex-pms-certification.md).
- `docs/COVERAGE_MATRIX.md` — `HOT-CH-01`, `HOT-CH-02`, `HOT-IBE-01`.
- `era-hotel-pms/src/lib/channel/adapters/`, `app/api/public/v1/availability/route.ts`.
