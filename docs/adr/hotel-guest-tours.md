# ADR: Guest group tours (Nafta weekend excursions)

**Status:** Accepted — **implemented** (evolved 2026-10-27)  
**Date:** 2026-08-23 (boarding policy 2026-10-27)  
**Scope:** `era-hotel-pms` group excursions for stay-linked guests (e.g. Naftalan → Göygöl / Ganja).  
**SKU:** existing `hotel_transfers` (do **not** add `hotel_tours`).  
**Coverage:** `HOT-TOUR-01` OpsUI + UAT-SMOKE UI §14b.  
**Ops spec:** [`era-hotel-pms/doc/TOURS-NAFTA-OPS.md`](../../era-hotel-pms/doc/TOURS-NAFTA-OPS.md)

Related: [hotel-city-ledger-and-fo-money.md](./hotel-city-ledger-and-fo-money.md) · [unified-settlement-hub.md](./unified-settlement-hub.md) · [hotel-module-taxonomy.md](./hotel-module-taxonomy.md)

## Context

Nafta runs weekend group excursions for staying guests. Individual A→B transfers (`TransferOrder`, revenue `TRANSFER`) cannot represent a shared bus, capacity, or multi-room manifest. Guests often reserve a seat and then do not travel — **seat hold ≠ sale**.

## Decision

### D1 — Same commercial SKU, three ops contours

```text
hotel_transfers
 ├── /transfers     individual A→B (flight filter replaces legacy /transfers/airport)
 ├── /tours          group excursions + roster + boarding
 └── /fleet          TransferVehicle CRUD
```

Do **not** keep a separate Airport menu item. Do **not** merge A→B and group-tour UX into one grid.

### D2 — Domain aggregates

| Entity | Meaning |
|--------|---------|
| `TourTemplate` | Recurring product defaults |
| `TourDeparture` | One calendar instance |
| `TourBooking` | Manifest line linked to a **reservation** |
| `TourOpsPolicy` | Org charge / boarding / overbook settings |

### D3 — Folio: own revenue codes; charge timing is policy

| Fact | Revenue role | Default moment |
|------|--------------|----------------|
| Transfer complete | `TRANSFER` | Complete order |
| Tour boarding | `TOUR` | Mark boarded / close boarding |

**`TourOpsPolicy.chargeMode` (default `CHARGE_ON_BOARDING`):**

- `CHARGE_ON_BOARDING` — add → `RESERVED` (no folio); board → `postCharge` `TOUR` → `CHARGED`
- `CHARGE_ON_ADD` — add → immediate `TOUR` charge (legacy “бронь = продажа”)

Paid only via allocation / desk pay / guest-tender folio settle. City-ledger-only settle → `ON_CITY_LEDGER`, not Paid.

Post-boarding cancel → **refund** (void unpaid / refund payment).

### D4 — Boarding close & overbook

- Default `boardingCloseMode = MANUAL` (close boarding button).
- Optional `AUTO_CUTOFF` (minutes before pickup) — policy field; enforcement may deepen later.
- `allowOverbook` default true on `RESERVED`; hard cap on boarded count = seat capacity.
- `dropUnboardedOnClose` default true.

Actors: organizer and/or reception use the same roster checkboxes + Close boarding (tablet or desk).

### D5 — UI law

List grids + modals only. Reservation/guest via autocomplete (`OPTION`/`CONFIRMED`/`IN_HOUSE` for transfers; tour add CONFIRMED/IN_HOUSE, board requires IN_HOUSE). Nothing without a stay.

### D6 — Not Front Cash pending

Tour cash appears on FO transactions after pay; not `SettlementPendingCharge`.

### D7 — Out of scope

Lunch box / F&B production · barcode tickets · walk-in without stay · Opera Tour Series · SKU `hotel_tours` · merging `DispatchVehicle` into fleet (later).

## Consequences

- Schema: `TourBookingStatus.RESERVED`, `TourOpsPolicy`, defaults boarding-first.
- APIs: board, close-boarding, policy GET/PATCH; Airport page redirects to `/transfers?hasFlight=1`.
- Docs/UAT updated for boarding default; `CHARGE_ON_ADD` remains a settings option.
