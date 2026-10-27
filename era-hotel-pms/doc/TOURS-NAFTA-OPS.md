# Guest tours — Nafta ops spec

**Status:** Implemented (boarding-first default, 2026-10-27)  
**ADR:** [`docs/adr/hotel-guest-tours.md`](../../docs/adr/hotel-guest-tours.md)  
**Coverage:** `HOT-TOUR-01`  
**SKU / gate:** `hotel_transfers`  
**Does not replace:** `/transfers` (`HOT-XFER-01`), `/concierge` (H-BL-20)

Nafta weekend group excursions (e.g. Göygöl). Lunch is **on-program at a restaurant**, not hotel kitchen / lunch-box / F&B production.

---

## 1. Actors

| Actor | Does |
|-------|------|
| Tour organizer | Create/edit departure; add stay-linked guests; mark boarded / close boarding (tablet or list); print manifest |
| Reception / cashier | Same boarding UI; collect CASH/CARD/BANK for `TOUR` from `/tours` or GUEST folio line-pay |
| Night audit | No special posting — charge already on folio at boarding (or at add if policy) |
| Kitchen / F&B | **Not in this process** |

---

## 2. Screens (IA)

Menu section **Transfers** (`hotel_transfers`):

| Item | Path | Notes |
|------|------|--------|
| Transfers | `/transfers` | A→B; filter «with flight» replaces Airport |
| Tours | `/tours` | Departures grid; create/edit in modals |
| Departure roster | `/tours` roster modal (`?roster=`) | Summary + roster grid; boarding checkboxes; icon toolbar |
| Fleet | `/fleet` | TransferVehicle CRUD (grid + modal) |
| Policy | `/settings/policies#tours` | `TourOpsPolicy` |

UI law: **grids + modals only**; reservation/guest **autocomplete**; no free-floating orders without a stay.

---

## 3. Money rules

```text
Default (CHARGE_ON_BOARDING):
  Add to roster     → RESERVED (no folio)
  Board / close     → FolioCharge TOUR → CHARGED
  Pay allocated     → PAID
  Folio settle 0 (guest tender) → remaining TOUR → PAID
  Balance 0 only via CL / COMPANY → ON_CITY_LEDGER
  Cancel after charge/pay → void / refund

Option (CHARGE_ON_ADD):
  Add to roster     → FolioCharge TOUR → CHARGED (legacy)
```

Revenue code **`TOUR`** (18%). Do **not** reuse `TRANSFER`. Demo/reference seed creates both; reports split on `RevenueCode`. Excursion price includes restaurant lunch — **one** folio line.

Transfer complete posts **`TRANSFER`** separately.

Walk-in without stay: out of MVP.

---

## 4. Policy (`TourOpsPolicy`)

| Field | Default |
|-------|---------|
| `chargeMode` | `CHARGE_ON_BOARDING` |
| `boardingCloseMode` | `MANUAL` |
| `autoCutoffMinutesBeforePickup` | null |
| `allowOverbook` | true |
| `dropUnboardedOnClose` | true |

Overbook applies to `RESERVED` only; boarded count cannot exceed seat capacity.

---

## 5. API

All gated with `hotel_transfers`.

| Method | Path | Role |
|--------|------|------|
| GET/PATCH | `/api/tours/policy` | Ops policy |
| GET/POST | `/api/tours/templates` | Catalog |
| GET/POST | `/api/tours/departures` | Calendar |
| GET/PATCH | `/api/tours/departures/:id` | Header |
| POST | `/api/tours/departures/:id/bookings` | Add stay → RESERVED or CHARGED |
| POST | `/api/tours/departures/:id/close-boarding` | `{ boardedBookingIds }` |
| POST | `/api/tours/bookings/:id/board` | Single board → TOUR charge |
| DELETE | `/api/tours/bookings/:id` | Cancel + void/refund |
| POST | `/api/tours/bookings/:id/pay` | Desk pay |
| GET | `/api/tours/in-house` | Eligible stays autocomplete |

Negatives: wrong stay status; duplicate stay; boarding over capacity; pay while RESERVED; module gate; vehicle conflict 409.

---

## 6. UAT

See [UAT-SMOKE.md](./UAT-SMOKE.md) §14b.
