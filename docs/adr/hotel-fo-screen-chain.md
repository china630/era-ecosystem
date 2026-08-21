# ADR: Hotel FO screen chain (sell → list → rack → plan)

**Status:** Accepted
**Date:** 2026-07-27
**Scope:** era-hotel-pms front-office navigation and inventory UX

## Context

Operators confused Room plan empty cells (free doors) with sellable inventory. ElectraWeb separates Room Type Availability (Avl/Occ by type x date) from Rack and Room Plan.

## Decision — FO priority order

| # | Screen | Route | Question |
|---|--------|-------|----------|
| 1 | Room type availability | `/availability` | How many of each type can still be sold on these dates? (Occ includes unassigned stays) |
| 2 | Reservation list | `/reports/reservations` | Which stays exist (arrivals / future), assign, check-in |
| 3 | Room rack | `/` | Door status now (Clean/Dirty, in-house) |
| 4 | Room plan | `/room-plan` | Who occupies which door across dates (bars) |
| 5 | Group / allotment | `/reports/group-reservations`, `/admin/allotment-blocks` | Booking envelopes and corporate blocks |

## Terminology

| Term | Meaning |
|------|---------|
| Booking | ReservationGroup envelope |
| RoomStay | Prisma Reservation (one sold room intent, roomCount=1) |
| Assignment | roomId (+ share pool + shareBedIndex 1..maxBed at assign; Stay at check-in) |
| Sellable (Avl) | quota minus **door** consumption (exclusive = 1 door; share packs beds by gender) — [hotel-shared-twin-assignment.md](./hotel-shared-twin-assignment.md) |
| Free door | Physical room without overlapping assigned stay (share pool may be n/maxBed occupied) |
| Share door | Up to maxBed independent RoomStays on one door, same gender (M or F only); checkbox on card, not guest count |

## Header entry points (FO ops shell)

Header quick links no longer duplicate availability / reservation list / rack / room-plan (those stay in the sidebar nav). With `RESERVATIONS_WRITE`:

| Button | Opens | Query shortcut |
|--------|-------|----------------|
| **Room booking** | Single-stay `ReservationCardModal` (create) | `?newBooking=1` / `?openReservation=1` |
| **Group booking** | `GroupBookingModal` — envelope + N room-stay lines → `POST /api/reservation-groups/book` | `?groupBooking=1` |

Group lines carry quantity × room type, pax, and live Avl vs needed per type (same `GET /api/fo/sellable` gate as the single card). Header: **Room booking** and **Group booking** both use `+` plus label.

Create modal uses `MODAL_FULL_CLASS` and `lg:grid-cols-[2fr_3fr]` like the room-stay card:
- Left (same order as room card): **Stay** (dates + nights + code/name) → **Product** (default room type → package/rate → meal) → **Commercial** (source → agency → sales contract → contract ref → booker guest → booker/guestRep/paidBy → payment → folio mode).
- Right: stay lines (scrollable) + sticky footer with totals (rooms / guests / nights) and sellable Avl.

Globals vs override: rate/meal/payment/commercial apply to all stays; **room type** has a Product default and may be overridden per stay line. Qty on a line = N RoomStay of that type (same pax); one booker `guestId` is primary on every stay until names are completed (names-incomplete gate).

Each stay line: room type override, qty, adults, children age bands, optional date override (empty = group dates). Dates clamp LTR on group and per-line pickers.

## Reservation card

Single room-stay card: **roomCount is not shown** on create/edit (always one stay = one room). Multi-room inventory is created only via Group booking.

On create, Product panel shows live sellable preview via GET /api/fo/sellable (same gate as create). Save blocked client-side when available < 1; server still enforces availability with i18n pointing to RTA. Adults cannot exceed room type `adultCapacity` (default 2 if unset).

**Nafta product fields (do not confuse with generic hotel “rate plan”):**

| Field | Meaning at Nafta |
|-------|------------------|
| Room type | Sellable category (STD-TWN, DLX, …) — not the physical door |
| Package / rate | Commercial product: `PKG-STANDART` / `PREMIUM` / `DERMO` / `DETOKS` (`medicalFlag`, often room-type scoped) **or** BAR (`type=BASE`, prices in `RoomTypeRate`) |
| Meal plan | Packages lock **FB** from `RatePlan.mealPlanId`; BAR-BB / BAR-FB set meal from the plan; FO may override only for non-package BAR |

**Product linkage:** choosing a type-scoped package sets room type; choosing room type filters out incompatible packages; BAR remains available for all types.

**Hints:** field `hint` renders as label/`?` tooltip (`title`), not under-field text.

**Party:** primary guest = `reservation.guestId` + `isPrimary` pax row; further +/search rows are companions (`isPrimary=false`). Incomplete (nameless) slots are filled before appending. Adults + children counts ↔ party list length are bidirectional (counts pad/trim empty slots; list add/remove adjusts adults then child buckets). Pax rows hydrate first/last from linked Guest only when `pax.guestId` matches (empty companion slots stay blank). Same `guestId` twice in one party is rejected on save. Named guests cannot claim overlapping stays on other rooms (TBA booker holds without names do not claim). Assignable doors: AVAILABLE / CLEAN / INSPECTED only; HK badge follows the selected dropdown room.

**Source ↔ Agency / OTA:** commercial Source (`WALKIN` / `AGENCY` / `BOOKING`) filters the second picker — Walk-in locks Individual; Agency shows non-OTA agencies (placeholder Select…, **no Individual**); Booking shows OTA counterparts (`isOtaAgency`). Changing source clears agency + sales contract.

**Party billing (`partyBillingMode`):** `PRIMARY` (default) — one folio owner (`ownsFolio` on primary only). `EQUAL` — each party member owns a personal OPEN GUEST folio (`ensurePartyGuestFolios` after pax save).

**Stays bar:** on every saved room-stay card (even without a Booking yet), show the stays strip + **Add stay**. First add calls `POST /api/reservations/:id/add-room`, which creates a Booking envelope if missing, then clones a sibling RoomStay.

**Group booking lines:** optional per-line check-in/out override (empty = group envelope dates). Live Avl preview still uses the group envelope dates.

**Names incomplete gate:** when primary display name looks like TBA / empty, or named pax count &lt; adults, block Assign and Check-in (badge on card).

Bottom “Packages” sub-modal (folio package lines) is **not** where FO picks Standart/Premium — that is the Product dropdown above.

## FO money / City Ledger

Inventory/FO chain above does **not** include cash close. City Ledger transfer, deposit@checkout, refunds, NA polish: [hotel-city-ledger-and-fo-money.md](./hotel-city-ledger-and-fo-money.md) · coverage `HOT-CASH-*` / `HOT-CL-*` · backlog P5 `H-BL-40…48`.

## References

- hotel-booking-hierarchy.md
- hotel-city-ledger-and-fo-money.md
- era-hotel-pms/doc/FRONT-OFFICE-ELECTRAWEB.md
- docs/HOSPITALITY_FINANCE_BOUNDARY.md
