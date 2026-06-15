# ADR: Deferred corporate checkout (Elektraweb T-room parity)

**Status:** Accepted (design); implementation phased  
**Date:** 2026-06-15  
**Scope:** `era-hotel-pms` — B2B / agency settlement after physical departure

## Context

Elektraweb Nafta uses **`Room No` prefixed with `T`** (e.g. `T85764991`) when a guest has **physically departed** but **financial settlement is pending** — typical for corporate / agency (city ledger) accounts on non-working days or invoice cycles.

Examples from Nafta operations (confirmed by property GM):

- Guest checks out on a **holiday / weekend**; company payment and invoice happen on the **next business day**.
- Reservation shows `State = CheckOut` with `Room No = T{Res Id}` until the agency settles.

Elektraweb also uses `T*` rows for **system ledger accounts** (not guest stays), e.g. `999 FB`, `DEBITORLAR`, `TIBB AMBULATOR FOLIO`, agency `Sanal Folyo`. These must **not** appear on the room plan as occupied rooms.

ERA Hotel PMS today:

- `checkoutReservation` requires **`assertZeroBalance`** on all open folios before `CHECKED_OUT`.
- Agency **city ledger** and `FolioType.AGENCY | COMPANY` exist, but checkout cannot complete with an open agency balance.
- Import from FOCP / Folio Transactions must classify `T` rows without storing `T{resId}` as a physical `Room.roomNumber`.

## Decision

### 1. Two classes of `T` rows (import + runtime)

| Class | Guest name pattern | Agency pattern | ERA handling |
|-------|-------------------|----------------|--------------|
| **Deferred settlement** | Real person / multi-name guest | Travel / medical agency, B2B contract | Normal reservation; see §2 |
| **System ledger** | `999 FB`, `DEBITORLAR`, `TIBB AMBULATOR FOLIO`, `CASH FOLIO`, … | `Sanal Folyo`, `RESTORAN FMB`, … | **Skip reservation import** or map to internal ledger stub; never room plan |

Classifier lives in `src/lib/import/elektraweb/legacy-folio-classifier.ts` (planned) and FOCP reservation adapter.

### 2. Operational vs financial state (deferred corporate checkout)

Do **not** model `T{ResId}` as a room. Split:

| Layer | Field | Values |
|-------|--------|--------|
| Physical | `Reservation.status` | `IN_HOUSE` → `CHECKED_OUT` on depart |
| Physical | `Stay.lastRoomNumber` | Last assigned numeric room (e.g. `805`) |
| Physical | `Reservation.roomId` | Cleared on depart (`null`) |
| Financial | `Reservation.checkoutSettlementStatus` | See enum below |
| Financial | `Folio.type` | Charges routed to `AGENCY` / `COMPANY` folio |
| Financial | `Folio.status` | `OPEN` until agency payment / invoice |

```prisma
enum CheckoutSettlementStatus {
  NOT_APPLICABLE  // walk-in; settled at desk
  PENDING         // departed; city ledger / invoice outstanding
  INVOICED        // invoice issued; payment pending
  SETTLED         // closed
}
```

Default: `NOT_APPLICABLE`. Set `PENDING` when depart checkout transfers balance to agency folio.

### 3. Two-step checkout workflow

**Step A — Depart (reception)**

- Allowed for `IN_HOUSE` with **non-zero balance** when `paymentMethod = COMPANY_ACCOUNT` or active B2B `salesContractId` / `agencyId`.
- Post remaining guest-folio balance to **AGENCY/COMPANY folio** (city ledger).
- Set `status = CHECKED_OUT`, `checkoutSettlementStatus = PENDING`, release room (`DIRTY` HK task).
- Do **not** require zero guest folio balance when city-ledger transfer is applied.

**Step B — Settle (back office / next business day)**

- Agency payment or invoice issue → `checkoutSettlementStatus = SETTLED`, close folios.
- Emit existing integration events (`SATELLITE_HOTEL_INVOICE_ISSUED`, city ledger snapshot E4) as today.

Walk-in / card / cash stays **single-step**: `assertZeroBalance` → `CHECKED_OUT` + `SETTLED`.

### 4. UI and reports

| Surface | Rule |
|---------|------|
| Room plan / chessboard | Only `IN_HOUSE` with numeric `roomId` |
| New report **Unsettled departures** | `CHECKED_OUT` + `checkoutSettlementStatus IN (PENDING, INVOICED)` |
| Agency ledger | Unchanged — sums AGENCY/COMPANY folio activity |
| Folio screen | Show guest folio closed + agency folio open for deferred stays |

### 5. Elektraweb import mapping

| Elektraweb FOCP / Folio | ERA |
|-------------------------|-----|
| `Res Id` | `Reservation.externalRef` = `electraweb:res:{id}` |
| `Room No` numeric | `roomId` while `IN_HOUSE`; `Stay.lastRoomNumber` after checkout |
| `Room No` = `T{ResId}` + real guest | Import as `CHECKED_OUT` + `PENDING`; no `roomId` |
| `State = CheckOut` + agency | `CHECKED_OUT`; settlement from `T` prefix + agency |
| Folio Transactions `Id` | `FolioCharge.externalRef` |

Historical folio bulk import (Stage 26) remains **charge-level**; reservation rows from FOCP must be imported **before** folio charges.

### 6. Phase 1 vs Phase 2

| Phase | Deliverable |
|-------|-------------|
| **P1 (Nafta UAT)** | Import classifier; FOCP mapping; docs; unsettled report stub |
| **P2** | Schema migration `checkoutSettlementStatus`, `Stay.lastRoomNumber`; `departWithCityLedger()` in checkout service; UI |

Phase 1 UAT does **not** require full historical folio replay — only open folio + in-house at cutover ([NAFTA_SANATORIUM_UAT.md](../NAFTA_SANATORIUM_UAT.md)).

## Consequences

### Positive

- Matches Nafta B2B reality without faking physical rooms.
- Reuses existing city ledger and `COMPANY_ACCOUNT` payment method.
- Clean room plan during pending agency settlement.

### Negative

- Two-step checkout adds reception training.
- Import must distinguish system `T` rows from deferred corporate rows (name/agency heuristics + manual review queue for ambiguous rows).

## References

- [hotel-elektraweb-import.md](./hotel-elektraweb-import.md)
- [hotel-b2b-sales-contracts.md](./hotel-b2b-sales-contracts.md)
- [era-hotel-pms/doc/ELEKTRAWEB-IMPORT.md](../../era-hotel-pms/doc/ELEKTRAWEB-IMPORT.md) — Folio merge + T-room
- [era-hotel-pms/doc/clone-spec/05-folio-and-cash.md](../../era-hotel-pms/doc/clone-spec/05-folio-and-cash.md) §5.9 City ledger
- Nafta validation: [13-nafta-validation-checklist.md](../../era-hotel-pms/doc/clone-spec/13-nafta-validation-checklist.md)
