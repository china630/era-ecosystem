# ADR: Hotel B2B sales contracts and MICE event orders

**Status:** Accepted  
**Date:** 2026-06-14  
**Scope:** `era-hotel-pms` — `hotel_distribution` (H-BL-30), `hotel_banquets` (H-BL-31)

## Context

ElektraWeb **Contract management** combines negotiated DERIVED rates, room allotments, season validity, agency/corporate counterparty, deposits, and group blocks. ERA had fragmented `ContractPricingRule` (% on flat rate), agency CRUD, and BEO MVP without full MICE depth.

P2 **H-BL-08** replaced legacy pricing with BAR + DERIVED rate plans ([hotel-dynamic-rate-plans.md](./hotel-dynamic-rate-plans.md)).

## Decision

### H-BL-30 — `SalesContract` + `ContractAllotment`

| Layer | Owner | Responsibility |
|-------|-------|----------------|
| Commercial contract + allotment | hotel-pms | Rates, blocks, `Reservation.salesContractId` |
| Counterparty MDM / AR | era-finance-core | VÖEN, invoices, city ledger (unchanged) |
| Pre-sales pipeline (optional) | era-crm | Lead handoff only — not guest CRM |

- **`SalesContract`**: code, counterparty (`AGENCY` \| `CORPORATE`), linked `ratePlanId` (DERIVED), season, status, commission flags. Optional `externalRef` = partner's contract number (free text; not a system join key).
- **`companyGuestId`**: legacy/merge FK only — **not** a UI counterparty. CORPORATE create/update requires `companyId`.
- **`ContractAllotment`**: room type × date range × nightly quota; consumed in availability (`contract-allotment.service.ts`, `channel.service.ts`).
- **Priority:** contract allotment block > OTA quota > BAR.
- **Migration:** `migrate-contract-pricing-to-derived.ts` creates DERIVED plans; extended script creates `SalesContract` rows with `legacyRuleId`.
- **UI:** `/distribution/contracts` (legacy `/admin/contracts` redirects). Create/edit is DRAFT-first with **explicit** counterparty type (no silent `AGENCY` default), agency **or** company, rate plan, season, commission, notes (`textarea`), optional `externalRef`. Row actions are **icon buttons** (edit / activate / cancel / expire / utilization / allotments / create block) — no overflow menu. Status lifecycle: `DRAFT→ACTIVE|CANCELLED`, `ACTIVE→EXPIRED|CANCELLED` (no reopen in this edition). ACTIVE rows past `validTo` show a past-season hint; sell path already rejects via `findActiveSalesContract` date window. Allotments are managed per contract (list / add / edit / delete); allotment date windows must sit inside the contract season (API-enforced). **EXPIRED/CANCELLED:** notes + `externalRef` only; allotments read-only (API rejects mutations); create-block hidden. **Create block** deep-links to `/distribution/allotment-blocks?contractId=` for operational holds (separate from contract quotas).
- **Allotment blocks UI:** `/distribution/allotment-blocks` — multi-line holds, optional `salesContractId`, edit + status (DEFINITE / RELEASED / CANCELLED), pickup → bookings. See [hotel-booking-hierarchy.md](./hotel-booking-hierarchy.md).
- **List API:** `GET /api/admin/contracts` filters `status`, `agencyId`, `companyId`.

### H-BL-31 — Event order extensions on `BanquetEvent`

- **`EventOrderLine`**: menu, AV, staff hours, room rental — qty × price.
- **`EventResourceBooking`**, **`EventStaffAssignment`**: resource calendar + staff plan.
- **Master folio:** package total posted on BEO confirm via `postCharge` to COMPANY/AGENCY folio when reservation linked.
- **fb-pos boundary (Nafta default):** base package on PMS master folio; event-day POS **extras only** via existing `beoId`.
- **Reports:** `/banquets/reports/profitability`, `/api/reports/event-profitability`.

### Nafta gate defaults

Documented in [era-hotel-pms/doc/nafta/B2B-GATE.md](../era-hotel-pms/doc/nafta/B2B-GATE.md).

## Open debts

| ID | Debt | Notes |
|----|------|--------|
| **SC-REST-01** | Date-scoped contract/rate restrictions (`minStay`, CTA, CTD) + booking / portal / availability enforcement | Not a season-wide boolean. Columns remain on `SalesContract` but are **hidden from create/edit UI** until this lands. |
| **SC-DEP-01** | `depositRequired` / `depositAmount` enforcement at book / check-in | Columns remain; **hidden from UI** until enforced. |
| **SC-REL-01** | `ContractAllotment.releaseDays` — return quota to free pool N days before stay | Field stays on allotment form with an explicit “not enforced yet” hint. |
| **SC-LIST-01** | Optional: migrate contracts list to `HotelDataGrid` Class B pagination | Icons-without-menu shipped; grid chrome is follow-up. |

## Consequences

- Reservations tagged with `salesContractId` use contract rate plan and allotment checks.
- Finance AR screens are not duplicated in hotel; agency profitability reports remain in hotel + Finance events.
- Full seating-plan JSON deferred; phase 1 uses pax zones / line items only.
- Decorative restriction/deposit checkboxes must not return to the contract form without SC-REST-01 / SC-DEP-01.

## References

- [hotel-module-taxonomy.md](./hotel-module-taxonomy.md) — `hotel_distribution`, `hotel_banquets`
- [hotel-channel-manager-pack.md](./hotel-channel-manager-pack.md) — same SKU also covers live OTA (Channex) and direct IBE; contracts stay in this key
- [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md) — optional future `SATELLITE_HOTEL_CONTRACT_ACTIVATED`
