# ADR: FO check-in / check-out business-day attribution

**Status:** Accepted  
**Date:** 2026-11-14  
**Scope:** `era-hotel-pms` Stay stamps, reservation list realized queues, FO Status realized tabs  
**Related:** [asia-baku-clock.md](./asia-baku-clock.md) · [hotel-fo-screen-chain.md](./hotel-fo-screen-chain.md) · plan `.cursor/plans/hotel-fo-business-day-checkin-out.plan.md`

## Context

FO chips «Bu gün gələnlər / çıxanlar» (`realizedArrivals` / `realizedDepartures`) filtered by wall-clock windows on `Stay.actualCheckIn` / `actualCheckOut`. FO Status realized rows used **planned** `checkInDate` / `checkOutDate`. After-midnight desk work with an open (or already advanced) business day made list and Status disagree, and planned Giriş/Çıxış columns looked “wrong” next to “today”.

Product rule: **one day axis = hotel business day**. Wall fact time stays factual and separate.

## Decision

### Two fields, two jobs

| Field | Meaning |
|-------|---------|
| `Stay.actualCheckIn` / `actualCheckOut` | Wall-clock instant when FO pressed the button. Never rewritten to “look like” the business day. |
| `Stay.checkInBusinessDate` / `checkOutBusinessDate` | Open `HotelProfile.currentBusinessDate` (civil UTC-midnight date stamp) at that press. |

While business day **D** is open, every CI/CO belongs to **D**, even if wall clock already shows D+1. After night audit advances to D+1, a later CI/CO is late on **D+1**.

### Read paths

| Surface | Realized “today” |
|---------|------------------|
| Reservation list queues | `checkInBusinessDate` / `checkOutBusinessDate` == current business day (`realizedArrivals` = IN_HOUSE \| CHECKED_OUT; `realizedDepartures` = CHECKED_OUT) |
| FO Status realized tabs | Same stamps and same status sets |
| Expected due-in / due-out | Unchanged — planned `checkInDate` / `checkOutDate` |
| HK / “Checked at” clocks | Still show wall `actual*` |

### List / Status date columns (UI)

Giriş / Çıxış on `/fo/reservations`, `/fo/in-house`, and FO Status list tables show **business stamps when present** (`checkInBusinessDate` / `checkOutBusinessDate`), else planned stay dates. Planned `checkInDate` / `checkOutDate` remain rate/occupancy truth and are not rewritten. Sort keys for arrival/departure (and default list secondary CI rank) follow the same display rule. `/fo/reservation-times` keeps explicit **planned** date columns; its day filter still uses stamps.

`/fo/reservation-times` day filter uses business stamps; time columns stay wall `actual*`. Default range ends on the open business day (`/api/business-date`), not wall Baku. FO Status default `date` is the same open business day.

### Undo checkout

Same-day undo clears `actualCheckOut` and `checkOutBusinessDate`. After-NA undo rules unchanged otherwise.

### Backfill

One-shot: derive stamps from Asia/Baku civil day of stored `actual*` (naive UTC wall). Historical after-midnight rows may sit on wall D+1; ops may review. New CI/CO always stamp the open business day.

## Consequences

- List and Status realized counts agree for the open business day.
- Planned stay dates remain rate/occupancy truth; they are not the realized-queue key.
- FO Giriş/Çıxış columns prefer business stamps so realized “today” tabs do not look wrong next to planned dates.
- Do not set `actualCheckIn` to business-day midnight.
