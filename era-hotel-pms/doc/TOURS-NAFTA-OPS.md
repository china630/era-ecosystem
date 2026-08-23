# Guest tours — Nafta ops spec and build plan

**Status:** Specified — **not coded** (2026-08-23)  
**ADR:** [`docs/adr/hotel-guest-tours.md`](../../docs/adr/hotel-guest-tours.md)  
**Coverage:** `HOT-TOUR-01` (PLANNED)  
**SKU / gate:** `hotel_transfers`  
**Does not replace:** `/transfers` (`HOT-XFER-01`), `/concierge` (H-BL-20)

Nafta weekend group excursions (e.g. Göygöl). Lunch is **on-program at a restaurant**, not hotel kitchen / lunch-box / F&B production.

---

## 1. Actors

| Actor | Does |
|-------|------|
| Tour organizer | Create/edit template and departure (date, agenda, hours, meeting point, cap, price); add/remove **in-house** guests; print manifest; see **Charged / Paid / City ledger** |
| Reception / cashier | Collect CASH/CARD for the tour from `/tours` or from the **GUEST** folio line; full folio settle also covers unpaid TOUR lines |
| Night audit | No special posting — charge already on folio at roster add |
| Kitchen / F&B | **Not in this process** |

---

## 2. Screens (target IA)

Menu section **Transfers** (`hotel_transfers`):

| Item | Path | Notes |
|------|------|--------|
| Transfers | `/transfers` | Existing A→B |
| Airport | `/transfers/airport` | Existing |
| **Tours** | `/tours` | List departures (week/calendar) |
| Departure | `/tours/[id]` | Header (description) + manifest |

### 2.1 Departure header (organizer)

- Date; pickup / depart / return times  
- Agenda (rich text / long text)  
- Meeting point; guide name; vehicle (optional `TransferVehicle`)  
- Capacity; seats taken; price per person  
- Status: DRAFT / OPEN / CLOSED / DEPARTED / CANCELLED  

Template (“every Sunday”) copies defaults onto a new departure; edits apply to that Sunday only.

### 2.2 Manifest

Columns: room, guest name, stay id, amount, **Charged / Paid / On CL**, booked at.

- **Add:** search IN_HOUSE (MVP). One stay (or guest) per departure (unique).  
- **Remove:** if not paid → void `TOUR` charge + drop row. If paid → block until refund/void payment policy.  
- **Pay:** reception — amount locked to line; CASH/CARD → folio payment allocated to that charge.  
- Print passenger list (room + name + phone if available) for driver/guide.

No barcode tickets in MVP.

---

## 3. Money rules

```text
Add to roster  →  FolioCharge TOUR  →  roster Charged
Pay allocated  →  FolioPayment linked to that charge  →  Paid
Full GUEST folio settle to 0 (guest tender)  →  remaining TOUR lines Paid
Balance 0 only via CL / COMPANY transfer  →  On city ledger (not desk-paid)
```

Revenue code **`TOUR`** (18% as other extras). Do not reuse `TRANSFER` (airport vs excursion P&L). Price of the excursion **includes** restaurant lunch in the sell price — **one** folio line, no `FOOD` split.

Walk-in without stay: out of MVP.

---

## 4. Data (target Prisma)

```text
TourTemplate     id, organizationId, code, name, defaultAgenda, defaultPickup, …
TourDeparture    templateId?, date, pickupAt, returnAt, agenda, meetingPoint,
                 guideName, vehicleId?, capacity, price, status, …
TourBooking      departureId, reservationId, guestId?, folioChargeId, folioPaymentId?,
                 status CHARGED | PAID | CANCELLED | ON_CITY_LEDGER, unique(departureId, reservationId)
```

`FolioPayment` (or allocation table) must gain **charge allocation** for GUEST line-pay and tour pay. Today payments are folio-level only — this is a **shared FO money** change, not tour-only.

Do **not** put tours on `TransferOrder`. Do **not** enqueue `SettlementPendingCharge`.

---

## 5. API (target)

All gated with `hotel_transfers`. Thin routes; logic in `src/lib/services/tour.service.ts`.

| Method | Path | Role |
|--------|------|------|
| GET/POST | `/api/tours/templates` | Catalog |
| GET/POST | `/api/tours/departures` | Calendar; `?from&to` |
| GET/PATCH | `/api/tours/departures/:id` | Header |
| GET | `/api/tours/departures/:id/manifest` | Roster + payment flags |
| POST | `/api/tours/departures/:id/bookings` | Add in-house → postCharge TOUR |
| DELETE | `/api/tours/bookings/:id` | Remove + void if unpaid |
| POST | `/api/tours/bookings/:id/pay` | Desk pay; allocate to charge |
| GET | `/api/tours/departures/:id/print` | Manifest HTML/PDF |
| POST | `/api/folios/charges/:chargeId/pay` | Shared line-pay (GUEST) |
| (existing settle) | `/api/folios/settle` | When balance 0 with guest tender → mark linked TourBookings PAID |

Negatives: not IN_HOUSE; duplicate stay; capacity full; pay after void; delete while PAID; module gate; wrong org.

---

## 6. Build waves (coding plan)

Do not start UI before W1–W2. Do not mark `HOT-TOUR-01` SHIPPED before W6 UAT UI.

### W0 — Docs (this change)

ADR + this spec + coverage PLANNED + menu/module-map + backlog `H-BL-50`. No product code.

### W1 — Schema and money primitives

- Prisma: template / departure / booking; revenue `TOUR` in seed/reference.  
- `FolioPayment`↔charge allocation (or `FolioPaymentAllocation`).  
- `postCharge` on book; `voidCharge` on unpaid remove.  
- Hook: GUEST folio settle-to-zero (guest tender) → cover open TOUR bookings on that reservation.  
- Unit tests: add/remove/pay/settle-zero/CL-not-paid.  
- **Stop:** no `/tours` page yet.

### W2 — HTTP API

- Routes in §5; Zod; `requireHotelModule('hotel_transfers')`.  
- Map `/tours`, `/api/tours` in `packages/satellite-kit` `HOTEL_MODULE_BY_ROUTE`.  
- `__tests__/tours-negative.spec.ts`.  
- Coverage still **API** (not SHIPPED).

### W3 — Ops UI `/tours`

- List + departure board (agenda, times, cap).  
- In-house picker; add/remove; Charged/Paid badges.  
- **Pay on roster** (same API as W2 pay).  
- i18n `en` / `az` / `ru`. CatalogField for status filters (`CLOSED_SMALL`).  
- Nav under Transfers.  
- Status **SCREEN** until UAT.

### W4 — Folio line-pay (GUEST)

- On `/folio/[reservationId]`: **Pay** on a charge row (amount locked).  
- Reuse allocation from W1.  
- Tour roster refreshes Paid. Later the same control can pay minibar/SPA — not required to ship tours.

### W5 — Print + fleet (full)

- Printable driver/guide manifest (`/tours/[id]/print`): hotel header, agenda, pickup/return, meeting point, guide, vehicle code/plate/driver/phone/seats, room/guest/phone/status table, pax and paid/unpaid totals, `@media print`.
- `/fleet` CRUD on `TransferVehicle` (retire = `active=false`; blocked if open tours/transfers).
- Assign vehicle before `DEPARTED`. Hard overlap vs other `TourDeparture` and `TransferOrder` (90 min transfer window) → 409.
- Capacity: live bookings ≤ min(departure.capacity, vehicle.maxSeats).
- DispatchVehicle stays separate.

### W6 — Closeout

- `era-hotel-pms/doc/UAT-SMOKE.md` UI path (no curl-only).  
- COVERAGE `HOT-TOUR-01` SHIPPED; Implementation-Matrix AC row + negatives; Product-Readiness UI only if Demo/TE updated — **do not** bump edition `ga`.  
- `npm run check:acceptance` · hotel tests · `ship:prepush` before push.

### Explicitly later / never in this epic

| Item | When |
|------|------|
| Kitchen lunch-box | Never for this Nafta process |
| Tickets / barcodes | Later |
| Walk-in no stay | Later |
| Line-pay UX on COMPANY/AGENCY | Later (AR path stays) |
| Storefront rename of SKU | Optional with W3 |
| Unify DispatchVehicle vs TransferVehicle | Fleet epic |

---

## 7. Acceptance (when coded)

- Organizer adds IN_HOUSE guest → folio shows `TOUR` immediately.  
- Roster unpaid while folio still has room balance.  
- Reception pays from `/tours` → Paid.  
- Reception pays TOUR line on folio → Paid.  
- Full GUEST settle to 0 → Paid without extra click.  
- Transfer remainder to CL → not desk-Paid.  
- Remove unpaid → charge voided.  
- Print list usable by driver.  
- No row on `/front-cash/pending`.

## 8. Honesty

Concierge `EXCURSION` ≠ Sunday bus. Transfers `HOT-XFER-01` ≠ group tour. This file is **spec**, not SHIPPED.
