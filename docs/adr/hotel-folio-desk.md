# Hotel folio desk

## Context

The cashier works from the reservation folio. Header money, night text, card terminals, and checkout were disagreeing with the server folio.

Bank POS devices are stored on the orchestrator. A sync that only saved the organization bind left the hotel process with an empty terminal list, so card payment had nothing to pick.

## Decision

- Hotel persists `FiscalDeviceMirror` when runtime-config includes `fiscalDevices`. `GET /api/fiscal/devices` loads that mirror, and if it is empty pulls orchestrator desired-state for `industry_hotel_pms`. Card payment requires an explicit terminal when any active BANK_POS exists. The first device is not selected for the cashier.
- Sync success is bind and runtime-config together. A finance bind file that cannot be written does not abort the database bind. Finance accepts the extra sync fields and ignores the device list.
- Folio header balance uses the server rule: charges times quantity, payments add, refunds subtract, voided payments are skipped. Stay amount stays the sum of nightly rates. A charge or payment does not overwrite it with the folio balance. The deposit chip shows HELD only. The desk button is always Accept payment plus the article (for what). The row is a folio payment; a credit is allowed when there is no debt. The cashier does not see the word deposit.
- Room charges store `night-audit:YYYY-MM-DD` or `manual-room:YYYY-MM-DD`. The screen translates that key. Free text on a room revenue code is replaced with the manual-room key for the posting date.
- Missed nights (check-in through the night before the open business date) are posted by a night auditor, manager, or hotel admin. `businessDate` stays the open hotel date. The night date stays in the note.
- Checkout shows two guest totals: charges vs money in (folio payments plus held cash). The cashier pays or refunds the net. The server allocates internally (matching article first, then oldest charge). The dialog does not ask the cashier to match articles. Guest personal debt is `GUEST_DEBT` plus `GuestDebtEntry`, with a note. The debts screen is `/front-cash/debts` (personal, agency, company). A later payment is `GuestDebtPayment` and lowers the remaining balance; it does not reopen the folio. The checkout `GUEST_DEBT` line is not drawer cash. The repayment is the cash-desk money taken, and the method totals on the cashier journal follow the same split. City ledger still accepts only agency and company folios.
- There is one check-out dialog (`FolioCheckoutModal`) for the folio tab, the room rack, and the reservation card stay action. It loads the stay folios itself and shows a block only for an open folio in debt. A guest block offers "Pay now" or "Leave debt on guest" (note required). An agency or company block names the payer and the amount and offers "Pay now" on that folio (cash, card with a required terminal, or bank transfer) or "Transfer to City Ledger". Guest and payer decisions are independent: the guest may pay extras while the agency owes the room. Nothing is preselected, and confirm stays disabled until every block has a choice. With no debt the dialog only confirms the check-out. Validation errors stay inside the dialog.
- The server never moves payer debt to City Ledger by default. `transferToCityLedger` must be `true`; otherwise open agency or company debt fails the check-out with 409 `PAYER_DEBT_UNRESOLVED` before any money is posted.
- Void, delete payment, refund, and both transfers require a note. The stay journal is the same `SatelliteAuditLog` (entity `Reservation`). Create/save, check-in/out, room moves, folio money, night audit, and Elektraweb write a labeled field diff (`section`, `source`, `fields`). The card journal is an event list (when / who / action / human summary) with expand to Field | Was | Now. Filters are action / section / actor / source. Raw Prisma keys and the flat Fields tab are not shown. `/settings/audit` stays the hotel-wide filter. IP is shown on the stay journal only for settings-capable users. The cash journal shows who took the payment and which terminal.
- The folio tab does not show the local fiscal strip or the card-authorization panel.

### Folio card wave (2026-10-22)

Law (do not reinvent):

- **Pocket** = who pays (named guest / agency / company).
- **Article** (`xərc maddəsi`) = what the money is for. One pocket is split by articles, not by a second “room vs bar” guest chip.
- **Pricing** edits the night grid. **Folio** shows debt after a night or extra posts. Folio never posts room nights.

Desk UI:

- Pocket chips on ribbon 1 (`Hamısı` only when two or more pockets). Deleted chip only when voids exist. Printer icon on that ribbon prints the **current filter** plus stay header and the words guest owes / overpaid / settled.
- Ribbon 2: `CatalogField` article + line kind (`Hamısı`, not “Bütün”) + search. Not three `Hamısı` chips.
- Cash bar: Extra charge / Extra payment only (payment is the red button). Titles match buttons. Invoice, folio checkout, missed nights, folio print, and close-folio are not on this bar. Empty pockets are hidden. Check-out stays the card footer. Agency/company invoices live on city ledger. Guest fiscal receipt is at payment time.
- Checkboxes stay. **Transfer** is enabled when at least one charge is selected. Row kebab: adjust / void / transfer / refund — not pay-one-night.
- Charge modal: pocket + article + amount. Payment modal: pocket + article + amount + tender (+ terminal). Keep the article on payment.

Allocation (implementation bug, not the law):

- Persist `revenueCodeId` on `FolioPayment`.
- Allocate only onto charges of that article. Leftover stays credit for that article.
- A later ROOM night consumes ROOM credit. Bar does not.

Signs: charges and payments show unsigned amounts plus kind. Header and footer use guest owes / overpaid / settled. Stay total is not replaced by folio net. HELD deposit stays its own chip.

Missed nights: pricing grid only (`postNight` per row; batch top-right when more than one yellow night). Lightning does not “charge all”. Today’s house nights are night audit.

Menus: kit `EraMenu` (outside click, Escape, item click closes) on lightning, card kebab, row kebab. Card kebab holds registration / proforma / confirmation prints.

## Consequences

Apply `20261014233000_folio_desk_journal` and `20261022010000_folio_payment_article` on the hotel database before the new screens are used. This ADR does not mark the flow SHIPPED: the UI is present and a UAT step is still missing (`HOT-FOLIO-DESK`).
