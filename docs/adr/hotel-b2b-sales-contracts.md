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

- **`SalesContract`**: code, counterparty (`AGENCY` \| `CORPORATE`), linked `ratePlanId` (DERIVED), season, status, commission/deposit flags.
- **`ContractAllotment`**: room type × date range × nightly quota; consumed in availability (`contract-allotment.service.ts`, `channel.service.ts`).
- **Priority:** contract allotment block > OTA quota > BAR.
- **Migration:** `migrate-contract-pricing-to-derived.ts` creates DERIVED plans; extended script creates `SalesContract` rows with `legacyRuleId`.
- **UI:** `/admin/contracts` replaces `/admin/contract-pricing` (redirect).

### H-BL-31 — Event order extensions on `BanquetEvent`

- **`EventOrderLine`**: menu, AV, staff hours, room rental — qty × price.
- **`EventResourceBooking`**, **`EventStaffAssignment`**: resource calendar + staff plan.
- **Master folio:** package total posted on BEO confirm via `postCharge` to COMPANY/AGENCY folio when reservation linked.
- **fb-pos boundary (Nafta default):** base package on PMS master folio; event-day POS **extras only** via existing `beoId`.
- **Reports:** `/banquets/reports/profitability`, `/api/reports/event-profitability`.

### Nafta gate defaults

Documented in [era-hotel-pms/doc/nafta/B2B-GATE.md](../era-hotel-pms/doc/nafta/B2B-GATE.md).

## Consequences

- Reservations tagged with `salesContractId` use contract rate plan and allotment checks.
- Finance AR screens are not duplicated in hotel; agency profitability reports remain in hotel + Finance events.
- Full seating-plan JSON deferred; phase 1 uses pax zones / line items only.

## References

- [hotel-module-taxonomy.md](./hotel-module-taxonomy.md) — `hotel_distribution`, `hotel_banquets`
- [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md) — optional future `SATELLITE_HOTEL_CONTRACT_ACTIVATED`
