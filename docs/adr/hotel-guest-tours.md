# ADR: Guest group tours (Nafta weekend excursions)

**Status:** Accepted — **not implemented** (2026-08-23)  
**Date:** 2026-08-23  
**Scope:** `era-hotel-pms` group excursions for in-house guests (e.g. Naftalan → Göygöl / Ganja).  
**SKU:** existing `hotel_transfers` (do **not** add `hotel_tours`).  
**Coverage:** `HOT-TOUR-01` SHIPPED after OpsUI + UAT-SMOKE UI §14b. 
**Ops spec + build waves:** [`era-hotel-pms/doc/TOURS-NAFTA-OPS.md`](../../era-hotel-pms/doc/TOURS-NAFTA-OPS.md)

Related: [hotel-city-ledger-and-fo-money.md](./hotel-city-ledger-and-fo-money.md) · [unified-settlement-hub.md](./unified-settlement-hub.md) · [hotel-module-taxonomy.md](./hotel-module-taxonomy.md)

## Context

Nafta typically runs a **group excursion every weekend** for staying guests. OPERA Cloud does not have a single “Tours & Transfers” module:

| OPERA surface | Role | ERA mapping |
|---------------|------|-------------|
| Reservation → Transportation | Point-to-point meet/greet | Existing `/transfers` (`HOT-XFER-01`) |
| Packages (sell separately) | One-off folio sell (tour as extra) | Charge `TOUR` on guest folio — **not** night-audit package as the only SoR |
| Rate Management → Tickets | Partner vouchers / barcodes | **Out of scope** (MVP) |
| Scheduled Activities | Guest timetable slots | Not SPA SKU; tours are logistics + roster |
| Tour Series | Wholesale series groups / operators | **Not this feature** (allotment / groups) |

ERA already ships individual transfers on `TransferOrder` (one reservation, IN/OUT, charge on **complete**). That model cannot represent a **shared bus**, **capacity**, **manifest across rooms**, or **charge at roster add**.

`ConciergeProduct` / `ConciergeOrder` (H-BL-20, category `EXCURSION`) is a **one-off catalog sell**, not a departure with seats and a passenger list. Keep it for external tickets / ad-hoc buys.

Kitchen / lunch-box / `era-fnb-pos` production orders are **out of scope**: the program includes a **restaurant lunch**, not hotel packed meals.

## Decision

### D1 — Same commercial SKU, three ops contours

Under `hotel_transfers` (storefront copy may read “Fleet, transfers & guest tours”; **key unchanged**):

```text
hotel_transfers
 ├── /transfers          individual A→B (airport / station / VIP)
 ├── /tours              group excursions + Sunday roster
 └── /fleet              shared vehicles (later; reuse TransferVehicle)
```

Do **not** merge A→B and group-tour UX into one grid. Entitlement: `/tours` and `/api/tours*` map to `hotel_transfers` (same as `/transfers`).

### D2 — Domain aggregates (not TransferOrder flags)

| Entity | Meaning |
|--------|---------|
| `TourTemplate` | Recurring product (name, default agenda, dow/time window, default price, default capacity) |
| `TourDeparture` | One calendar instance (date, pickup/return, agenda, meeting point, guide, vehicle, seat cap, cutoff) |
| `TourBooking` | Manifest line: in-house stay + guest, `folioChargeId`, payment link, status |

Capacity is on the **departure**. Roster rows are many reservations on one departure.

### D3 — Folio: charge on add, paid only when allocated

Adding a guest to the roster **immediately** `postCharge`s revenue code **`TOUR`** on the **guest** folio (stay CONFIRMED or IN_HOUSE; Nafta MVP: **IN_HOUSE** picker). Store `folioChargeId` on `TourBooking`.

**Paid ≠ folio balance zero.** Folio payments today are **folio-level** (`FolioPayment` has no `chargeId`). Tour “Оплачено” requires an **explicit allocation**:

1. Pay from `/tours` (reception) — amount locked to the TOUR line → `postPayment` + link `folioPaymentId`.
2. Pay from folio UI — **pay this charge line** (GUEST folio). Same allocation.
3. **Full folio settle to zero** (cash/card/deposit on that GUEST folio) → remaining non-voided charges including TOUR are covered → roster **Оплачено**.

Do **not** infer paid from “any payment exists” or “payments ≥ tour amount” without allocation.

**Not** “paid” if GUEST balance is cleared only by **transfer to CITY LEDGER / COMPANY / AGENCY** without a guest tender — roster should show **On city ledger / agency**, not “paid at desk”.

Line-pay engine is folio-agnostic; **desk “pay this line” UX** is for **GUEST** folios. COMPANY/AGENCY stay whole-folio / AR (existing P5).

### D4 — Not the Front Cash pending hub

`/front-cash/pending` (`SettlementPendingCharge`) is for **walk-in F&B/clinic** without (or not using) a hotel folio. In-house tour is **folio**, like room and minibar.

Tour cash **does** appear on `/front-cash/transactions` as a normal FO payment after pay.

### D5 — Out of scope (MVP)

- Lunch box / kitchen / F&B ticket from roster count  
- Partner barcode tickets  
- Walk-in guests with no stay  
- Opera Tour Series (operator groups)  
- New SKU / new satellite  
- Putting tours in `hotel_spa_scheduling`  
- Using `DispatchVehicle` as a second fleet (unify later under `TransferVehicle`)

## Consequences

- Schema + APIs + `/tours` UI are a **new delivery wave**; concierge and transfers stay as-is.  
- Shared infra: **charge-level payment allocation** on GUEST folio (needed for honest tour paid flags; reusable for minibar/SPA later).  
- Docs: this ADR + `TOURS-NAFTA-OPS.md`; coverage `HOT-TOUR-01` stays **not SHIPPED** until UAT UI.  
- Storefront/taxonomy human name may widen; **module key** `hotel_transfers` stays.

## Alternatives considered

| Option | Why rejected |
|--------|----------------|
| `type=TOUR` on `TransferOrder` | Breaks 1:1 reservation logistics; no shared capacity |
| Concierge only | No seats, cutoff, print manifest, multi-room roster |
| Package night-audit line only | No ops roster / driver list |
| Pending settlement hub | Wrong guest class (in-house vs walk-in satellite) |
| SKU `hotel_tours` | Extra commercial key for one ops screen |
