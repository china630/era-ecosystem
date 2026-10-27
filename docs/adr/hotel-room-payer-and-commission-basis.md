# Hotel — room payer and commission basis

## Status

Accepted — 2026-10-27

## Context

Agency on a stay means “guest came from” and often a commission. It does not mean the agency pays the room. Company on a stay usually does pay the room (city ledger). Reception mixed those ideas with folio routing and empty agency pockets. Elektraweb often posts lodging on the agency tab so commission can be read from that tab; that makes a cash-paying guest look like agency debt.

## Decision

1. **Room payer** (`Reservation.roomPayer`: `GUEST` | `AGENCY` | `COMPANY`) is the single answer for where ROOM and room tax post. Defaults: company present → `COMPANY`; otherwise `GUEST`. Agency alone stays `GUEST` until the desk chooses agency.
2. **Commission basis** (`GROSS` | `NET`) is independent. Gross: full room on the folio, commission accrued in reports. Net: price already net of commission; reports show zero commission for those nights.
3. **Sales contract** is required only when the room payer is the agency or the company (or when their rate/allotment is required). Guest pays + gross + agency percent on the agency card needs no contract.
4. Agency and company folio pockets open only when a charge or payment is routed there. They are not opened empty for commission.
5. Mid-stay change of payer, basis, or party writes a `ReservationCommercialPeriod`, a BILLING folio note, and optionally moves posted ROOM lines (`NEXT_NIGHTS` vs `MOVE_POSTED`).
6. Contract form stores `commissionBasis`. The reservation card strip shows the two answers and a read-only sentence; `contractRef` free text is removed from that strip.

## Consequences

- `resolveRoutedFolioType` uses `roomPayer` for room/tax after stay overrides and property rules.
- Agency analysis treats `NET` stays as zero commission; percent prefers the sales contract, else the agency card.
- FO helpers: `defaultRoomPayerFromContract` / `defaultsFromSalesContract` — corporate contract → `COMPANY` (+ basis/FKs); agency contract applies FKs/basis only (does not force `AGENCY`).
- Create-time sellable preview with `salesContractId` uses contract allotment (`GET /api/fo/sellable`), not BAR-only.
- Related: [hotel-folio-desk.md](./hotel-folio-desk.md), [hotel-agency-vs-company-profiles.md](./hotel-agency-vs-company-profiles.md), [hotel-city-ledger-and-fo-money.md](./hotel-city-ledger-and-fo-money.md).
