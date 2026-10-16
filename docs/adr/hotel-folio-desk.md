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
- Checkout shows charged, paid, and debt by article. Unallocated money is spread from the oldest charge. Pay-all writes those allocations. Guest personal debt is `GUEST_DEBT` plus `GuestDebtEntry`, with a note. The debts screen is `/front-cash/debts` (personal, agency, company). A later payment is `GuestDebtPayment` and lowers the remaining balance; it does not reopen the folio. The checkout `GUEST_DEBT` line is not drawer cash. The repayment is the cash-desk money taken, and the method totals on the cashier journal follow the same split. City ledger still accepts only agency and company folios.
- There is one check-out dialog (`FolioCheckoutModal`) for the folio tab, the room rack, and the reservation card stay action. It loads the stay folios itself and shows a block only for an open folio in debt. A guest block offers "Pay now" or "Leave debt on guest" (note required). An agency or company block names the payer and the amount and offers "Pay now" on that folio (cash, card with a required terminal, or bank transfer) or "Transfer to City Ledger". Guest and payer decisions are independent: the guest may pay extras while the agency owes the room. Nothing is preselected, and confirm stays disabled until every block has a choice. With no debt the dialog only confirms the check-out. Validation errors stay inside the dialog.
- The server never moves payer debt to City Ledger by default. `transferToCityLedger` must be `true`; otherwise open agency or company debt fails the check-out with 409 `PAYER_DEBT_UNRESOLVED` before any money is posted.
- Void, delete payment, refund, and both transfers require a note. The stay journal is the same `SatelliteAuditLog` (entity `Reservation`). Create/save, check-in/out, room moves, folio money, night audit, and Elektraweb write a labeled field diff (`section`, `source`, `fields`). The card journal has two tabs: feed (action, user, time, summary) and fields (field × from/to). `/settings/audit` stays the hotel-wide filter. IP is shown on the stay journal only for settings-capable users. The cash journal shows who took the payment and which terminal.
- The folio tab does not show the local fiscal strip or the card-authorization panel.

## Consequences

Apply `20261014233000_folio_desk_journal` on the hotel database before the new screens are used. This ADR does not mark the flow SHIPPED: the UI is present and a UAT step is still missing (`HOT-FOLIO-DESK`).
