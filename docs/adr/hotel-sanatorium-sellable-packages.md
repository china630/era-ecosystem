# ADR: Hotel sanatorium sellable packages, door filter, pricing hub

**Status:** Accepted  
**Date:** 2026-11-27  
**Scope:** `era-hotel-pms` FO reservation card, SatAdmin Rates, clinic program sync; entitlement `hotel_medical_sanatorium`

## Context

Nafta FO mixed clinic program dumps, hardcoded `PKG-STANDART|PREMIUM|DERMA|DETOKS`, Infotur-as-guest-SKU confusion, agency-name package guessing (Elektraweb residue), room lists that ignored Given room type, and scattered pricing toggles. City hotels must not see sanatorium chrome.

## Decision

### D1 — Gate

Sanatorium package UI/API (FO Guests package column, MEDICAL/INFOTUR stay product set, `/settings/sanatorium-packages`, medical package-prices entry, clinic sanatorium checkout chrome) require active entitlement **`hotel_medical_sanatorium`**. Without it, FO behaves as a city hotel (BAR / daily / yield / manual only).

### D2 — Hotel sellable package catalog

SoR for FO package **lists** is hotel DB table **`HotelSellablePackage`** (snapshot), not a live clinic call on every card open.

| Field | Role |
|-------|------|
| `code` | Stable SKU (`PKG-…`), unique per org |
| `family` | `MEDICAL` \| `INFOTUR` (stored; no name regex after cutover) |
| `active` | Sellable on FO |
| `ratePlanId` | Optional link to stay tariff / sell grid |
| `minNights` / `maxNights` / `durationDays` | Synced from clinic `ProgramTemplate` |
| `name`, `sortOrder` | Display |

Clinic `ProgramTemplate` remains clinical composition SoR; sync refreshes hotel rows (codes + night bounds). Empty **active MEDICAL** set with gate ON is **misconfig**: block Medical Rates selection; do not invent default SKUs in code.

### D3 — Infotur vs MEDICAL on the card

- **INFOTUR** (including variants such as Infotur Premium): stay tariff on the left (Rate/package). Not mixed per guest in one room.
- **MEDICAL**: Guests column when **≥2** active MEDICAL catalog rows; **1** active → auto-stamp all pax, no column; **0** → see D2.
- Night prices: MEDICAL mix uses compose grid; Infotur uses its own sell-grid cells. Missing cell → explicit error (plan × room type × meal × occupancy × date).

### D4 — No hardcode / no agency-name SKU

Forbidden as package SoR: hardcoded SKU arrays, `/INFOTUR/` family detection after migration, guessing package from agency display name, `Agency.medicalPackageCode` as FO source of truth. Package on stay = explicit card choice, catalog auto-stamp, contract `ratePlanId` (Infotur stay), or import with an explicit catalog code.

Leisure / skip clinic lifecycle: tariff family + absence of MEDICAL guest package — not Walkin leisure name heuristics.

### D5 — Door list

**Room no.** options use physical type `givenRoomTypeId || roomTypeId`. Different charged vs given (upgrade) keeps settlement (who pays). Cross-type doors are not offered in the list.

### D6 — Contract vs price

`SalesContract` carries counterparty, `ratePlanId`, season, allotment — not the nightly price list. Corp auto-contract may stamp Infotur; amount comes from the rate plan sell grid.

### D7 — Pricing hub

`HotelProfile.policyJson` / Settings pricing hub exposes base products and overlays (packages gated, BAR, daily, yield/`loadBasedPricingEnabled` default off, occupancy, child absolute, manual night override, `yieldAppliesToPackages` default false). Links to package-prices, BAR, daily, yield-rules, components, sanatorium-packages.

## Consequences

- Replace `medicalPackageChoices` / `MEDICAL_PACKAGE_CODES` FO paths with catalog queries.
- Dual-run ADR agency-name / clinic-live FO list rules are superseded for live FO (import may still map explicit codes).
- UI rule: Given room type **is** the door filter again ([hotel-reservation-card-and-party-ops](./hotel-reservation-card-and-party-ops.md) D3).

## Related

- [hotel-fo-screen-chain.md](./hotel-fo-screen-chain.md)
- [clinic/nafta-medical-sku-dual-run.md](./clinic/nafta-medical-sku-dual-run.md) (superseded FO list / agency SoR clauses)
- [hotel-b2b-sales-contracts.md](./hotel-b2b-sales-contracts.md)
- [hotel-occupancy-and-load-pricing-flags.md](./hotel-occupancy-and-load-pricing-flags.md)
- [hotel-bar-accounting-vs-package-sell.md](./hotel-bar-accounting-vs-package-sell.md)
- Coverage: HOT-PKG-05 (catalog), HOT-PKG-02 deepen, HOT-FO-02 door filter deepen
