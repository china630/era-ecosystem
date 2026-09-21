# ADR: Hotel booking hierarchy (Block -> Booking -> RoomStay -> Assignment)

**Status:** Accepted
**Date:** 2026-07-22
**Scope:** `era-hotel-pms` — FO reservations, corporate allotments, folio ownership

## Context

One Reservation row mixed booking + product + assignment. Corporate negotiation blocks were missing (`ContractAllotment` remains contract quota only).

## Decision

### Mapping (variant A)

| Domain | Prisma | Notes |
|--------|--------|-------|
| Allotment block | AllotmentBlock + lines | TENTATIVE/DEFINITE/CANCELLED/RELEASED; cutoff soft-release |
| Booking | ReservationGroup | folioMode, allotmentBlockId, envelope dates |
| RoomStay | Reservation | One **door + charged product** (`roomCount=1`); optional `roomId`. Party (`ReservationGuest`) lives on the stay — not “one person per row”. See [hotel-reservation-card-and-party-ops.md](./hotel-reservation-card-and-party-ops.md) |
| Assignment | roomId + share pool + shareBedIndex + Stay | Physical door; share pool for union twin — see [hotel-shared-twin-assignment.md](./hotel-shared-twin-assignment.md) |
| Master guest | ReservationGuest.isPrimary | Folio owner per stay (PRIMARY mode) |
| Party billing | Reservation.partyBillingMode | PRIMARY (one owner) / EQUAL (each ownsFolio → personal GUEST folio) |
| Folio mode | ReservationGroup.folioMode | INDIVIDUAL / MASTER / SPLIT |

### Implemented follow-ups

- Cutoff cron: POST /api/cron/allotment-block-cutoff (Bearer HOTEL_CRON_SECRET) -> RELEASED
- MASTER/SPLIT posting: booking-folio.service routes room&tax to AGENCY on master stay; extras to GUEST
- Pickup UI: `/distribution/allotment-blocks` — create/edit multi-line blocks, optional sales contract link, status transitions, Pickup creates Booking + N stays
- Contracts bridge: `/distribution/contracts` → **Create block** opens allotment-blocks with `?contractId=` prefilling season/agency

### Still deferred

- Prisma rename Reservation -> RoomStay (semantic only today)
- Person-level **Depart guest** / **Move guest** / **Swap rooms** and reservation-card IA target — [hotel-reservation-card-and-party-ops.md](./hotel-reservation-card-and-party-ops.md)

## References

- hotel-b2b-sales-contracts.md
- era-hotel-pms/.cursor/rules/era-hotel-pms-ui.mdc

## Related

- [hotel-fo-screen-chain.md](./hotel-fo-screen-chain.md) — FO menu priority and sellable vs doors
- [hotel-shared-twin-assignment.md](./hotel-shared-twin-assignment.md) — union share pool (not household party)
- [hotel-reservation-card-and-party-ops.md](./hotel-reservation-card-and-party-ops.md) — stay card IA; exclusive party vs share vs booking
