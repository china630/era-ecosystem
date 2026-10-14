# Hotel folio desk

## Context

The cashier works from the reservation folio. Header money, night text, card terminals, and checkout were disagreeing with the server folio.

Bank POS devices are stored on the orchestrator. A sync that only saved the organization bind left the hotel process with an empty terminal list, so card payment had nothing to pick.

## Decision

- Hotel persists `FiscalDeviceMirror` when runtime-config includes `fiscalDevices`. `GET /api/fiscal/devices` loads that mirror, and if it is empty pulls orchestrator desired-state for `industry_hotel_pms`. Card payment requires an explicit terminal when any active BANK_POS exists. The first device is not selected for the cashier.
- Sync success is bind and runtime-config together. A finance bind file that cannot be written does not abort the database bind. Finance accepts the extra sync fields and ignores the device list.
- Folio header balance uses the server rule: charges times quantity, payments add, refunds subtract, voided payments are skipped. Stay amount stays the sum of nightly rates. A charge or payment does not overwrite it with the folio balance. The deposit chip shows HELD only. Money taken while the folio is in debt is a payment, not a new deposit.
- Room charges store `night-audit:YYYY-MM-DD` or `manual-room:YYYY-MM-DD`. The screen translates that key. Free text on a room revenue code is replaced with the manual-room key for the posting date.
- Missed nights (check-in through the night before the open business date) are posted by a night auditor, manager, or hotel admin. `businessDate` stays the open hotel date. The night date stays in the note.
- Checkout shows charged, paid, and debt by article. Unallocated money is spread from the oldest charge. Pay-all writes those allocations. Guest personal debt is `GUEST_DEBT` plus `GuestDebtEntry`, with a note. The list is `/front-cash/guest-debt`. City ledger still accepts only agency and company folios.
- Void, delete payment, refund, and both transfers require a note. The stay journal reads `SatelliteAuditLog` rows for the reservation. The cash journal shows who took the payment and which terminal.
- The folio tab does not show the local fiscal strip or the card-authorization panel.

## Consequences

Apply `20261014233000_folio_desk_journal` on the hotel database before the new screens are used. This ADR does not mark the flow SHIPPED: the UI is present and a UAT step is still missing (`HOT-FOLIO-DESK`).
