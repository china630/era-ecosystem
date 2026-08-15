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
| RoomStay | Reservation | roomCount=1 on create; optional roomId |
| Assignment | roomId + Stay | Physical room at check-in |
| Master guest | ReservationGuest.isPrimary | Folio owner per stay (PRIMARY mode) |
| Party billing | Reservation.partyBillingMode | PRIMARY (one owner) / EQUAL (each ownsFolio → personal GUEST folio) |
| Folio mode | ReservationGroup.folioMode | INDIVIDUAL / MASTER / SPLIT |

### Implemented follow-ups

- Cutoff cron: POST /api/cron/allotment-block-cutoff (Bearer HOTEL_CRON_SECRET) -> RELEASED
- MASTER/SPLIT posting: booking-folio.service routes room&tax to AGENCY on master stay; extras to GUEST
- Pickup UI: /admin/allotment-blocks Pickup creates Booking + N stays

### Still deferred

- Prisma rename Reservation -> RoomStay (semantic only today)

## References

- hotel-b2b-sales-contracts.md
- era-hotel-pms/.cursor/rules/era-hotel-pms-ui.mdc

## Related

- [hotel-fo-screen-chain.md](./hotel-fo-screen-chain.md) — FO menu priority and sellable vs doors
