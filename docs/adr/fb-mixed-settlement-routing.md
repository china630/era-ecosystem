# ADR: F&B mixed settlement (in-house folio vs walk-in POS)

**Status:** Accepted  
**Date:** 2026-06-10  
**Related:** [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md) · [org-operating-mode.md](./org-operating-mode.md) · [sanatorium-vnext.md](./sanatorium-vnext.md) SV5/SV14

## Context

`era-fnb-pos` is an autonomous industry satellite (standalone restaurant or hotel-attached). At Nafta the same deployment serves:

- **In-house** hotel/sanatorium guests → revenue on **hotel folio**, fiscal at checkout;
- **Walk-in** street guests → **local POS pay + KKM** at the register.

Previously, `POST /api/tickets/{id}/pay` applied org-level `shouldFiscalizeOnParent` to all direct payments. A `DEPARTMENT` org with `fiscalRouting=PARENT` incorrectly skipped fiscalization for walk-in tickets.

Clinic already splits behaviour via `patientOrigin` (`IN_HOUSE` vs `WALK_IN`). F&B needed ticket-level parity.

## Decision

1. **`billing-router.ts`** in `era-fnb-pos` resolves settlement per ticket:
   - **IN_HOUSE** when `roomChargeReservationId` is set or `serviceChannel=ROOM_SERVICE` → `HOTEL_FOLIO` (room charge only).
   - Otherwise → `LOCAL_CASHIER` (pay at POS with local fiscal, regardless of org `operatingMode`).

2. **`POST …/pay`** returns **400** for `HOTEL_FOLIO` tickets (same message pattern as clinic cashier).

3. **`POST …/room-charge`** requires an in-house link; walk-in tickets must pay locally.

4. **Fiscalization:** only `LOCAL_CASHIER` tickets call `fiscalizeForSatellite` on pay. Room charge never fiscalizes at F&B.

5. **Org model:** F&B may use a **DEPARTMENT** org (parent = hotel) symmetric to clinic; walk-in behaviour must remain correct via ticket-level routing, not org-level blanket flags.

## Implementation

- `era-fnb-pos/src/lib/billing-router.ts`
- `app/api/tickets/[id]/pay/route.ts`
- `app/api/tickets/[id]/room-charge/route.ts`
- `__tests__/billing-router.spec.ts`

## Consequences

- Mixed restaurant at a sanatorium works without forcing F&B onto the hotel org UUID.
- Nafta docker stack uses separate org env vars (`ERA_FB_ORGANIZATION_ID`, etc.) — see [NAFTA_SANATORIUM_UAT.md](../NAFTA_SANATORIUM_UAT.md).
- Future: explicit `guestOrigin` enum on `Ticket` if `serviceChannel` alone is insufficient.
