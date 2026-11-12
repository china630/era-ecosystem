# ADR: Transfer + tour stay lifecycle

**Status:** Accepted — implementing  
**Date:** 2026-11-11  
**Scope:** `era-hotel-pms` stay-linked `TransferOrder` and `TourBooking`  
**SKU:** `hotel_transfers` · Coverage HOT-XFER-01 / HOT-TOUR-01  

Related: [hotel-guest-tours.md](./hotel-guest-tours.md) · early-checkout unused nights

## Context

Transfers and tour seats are bound to a reservation. Cancel, date amend, and early checkout previously left open BOOKED/CONFIRMED transfers and RESERVED tour seats on the board — wrong headcount and driver/tour manifests. Room number is already live via `reservation.room` (no denorm).

## Decision

### D1 — Open sets

- Transfer open: `BOOKED` | `CONFIRMED`
- Tour open seat (auto): `RESERVED` only (boarding-first; nothing on folio yet)
- `DONE` / boarded (`CHARGED`|`PAID`|`ON_CITY_LEDGER`) / `CANCELLED` are not auto-shifted

### D2 — Stay cancel / no-show

Auto-cancel all open transfers (`cancelTransfer`) and all stay `RESERVED` tour bookings. No UI confirm. Restore stay does **not** revive them.

### D3 — Date amend (transfers)

ASK: every open transfer needs `SHIFT` | `KEEP` | `CANCEL` before dates save (`409 TRANSFER_DATE_PENDING` if missing).  
Suggested SHIFT: IN → new check-in day, OUT → new check-out day; keep Baku wall-clock time.  
Tours on date amend: no auto reschedule; auto-cancel `RESERVED` seats whose departure day (Baku) is **≥** the new check-out day (same cut as D5).

### D4 — Early checkout — outbound transfer (option C)

Open `OUT` transfers require per-order `SHIFT` | `CANCEL` | `LEAVE` in checkout body (`409 TRANSFER_OUT_PENDING`).  
SHIFT → new departure day (= today Baku) + prior time. LEAVE keeps the order (board may warn).

### D5 — Early checkout — tours

Auto-cancel `RESERVED` tour bookings whose departure calendar date (Baku) is **≥** the new checkout day. Boarded rows untouched. Keeps roster headcount honest.

### D6 — Room / door move

No write on transfer/tour rows. Print, roster, and driver sheet always read `reservation.room.roomNumber`.

### D7 — Fleet after SHIFT

Re-check vehicle slot; on conflict clear `vehicleId` and set status `BOOKED`.

### D8 — Undo early checkout

If OUT was SHIFT, restore prior `pickupAt` / vehicle from checkout audit snapshot. Cancelled tour RESERVED seats are not restored.

## Consequences

- Services: `stay-mobility-sync.service.ts`; hooks in cancel, checkout, `patchReservationFull`
- Nest: stay preview/apply + checkout/full body fields
- UI: checkout OUT decisions; date-amend transfer modal; reservation card transfer/tour chips
- UAT §14 / §14b; COVERAGE notes; edition unchanged (`mvp`)
