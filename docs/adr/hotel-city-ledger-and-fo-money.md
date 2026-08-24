# ADR: Hotel City Ledger ops + FO money close

**Status:** Implemented (P5 H-BL-40…48 — 2026-08-03)
**Date:** 2026-08-03
**Scope:** era-hotel-pms front cash, checkout, City Ledger handoff; boundary to era-finance-core AR

## Context

Nafta FO money backlog (City Ledger / deposit pay / Night Audit polish / settle / folio close / discounts / refunds) must be tracked honestly. DELIVERY stages mark many cash/CL items `[x]`, but Opera-depth AR (terms, aging, invoice matching, transfer-to-AR at checkout) is **not** shipped.

Architecture already splits planes ([HOSPITALITY_FINANCE_BOUNDARY.md](../HOSPITALITY_FINANCE_BOUNDARY.md)):

| Plane | Owns |
|-------|------|
| **Hotel PMS** | Guest/company/agency **folios**, routing, settle, deposits, operational CL snapshot, checkout gates |
| **Finance** | Sales invoices, counterparty AR, aging, bank apply / invoice matching, GL |

## Current state (2026-08-03 implementation — P5)

| Capability | Status | Notes |
|------------|--------|-------|
| Folio types GUEST / COMPANY / AGENCY | SHIPPED | `FolioType`; EQUAL party personal GUEST folios |
| Folio routing rules | SHIPPED | `FolioRoutingRule` by revenue code; MASTER/SPLIT booking |
| Credit limit on stay | SHIPPED (gate) | `city-ledger-gate.service` + contract + Agency/stay limit + open AR exposure |
| Settle multi-method | SHIPPED | CASH/CARD/COMPANY/LOYALTY/**DEPOSIT**; hub `/front-cash/pending` |
| Deposit lifecycle | SHIPPED | HELD→APPLIED@check-in/settle/checkout; REFUNDED leftover HELD |
| Checkout folio close | SHIPPED | Guest zero; COMPANY/AGENCY → PENDING_AR→TRANSFERRED_AR; per-folio close |
| Night Audit | SHIPPED (+ polish) | Core EOD + exceptions / auto no-show / trial preview on `/operations` |
| Agency CL snapshot | SHIPPED (ops) | Ledger + settlement against TRANSFERRED_AR; Finance owns AR match |
| Payment terms / aging / invoice matching | SHIPPED (Finance) | Counterparty `paymentTermsDays`; `/reporting/aging`; `/sales/invoices/allocate` |
| Folio payment refunds | SHIPPED (mock fiscal) | `POST /api/folios/payments/[id]/refund`; `FolioPayment.kind=REFUND` |
| Early unused-nights refund | SHIPPED | ADR hotel-early-checkout-unused-nights; HOT-CO-04; apply before CL transfer |
| Checkout discounts | SHIPPED | Negative `DISCOUNT` charge at settle/checkout + promo/`discountPct` |
| Transfers / Banquets | SHIPPED (MVP) | unchanged |
| Guest tours (in-house roster) | **Not implemented** | ADR [hotel-guest-tours.md](./hotel-guest-tours.md) — charge on GUEST folio, not pending hub |
| Agency settlement ops | SHIPPED (ops) | Hotel postpaid apply; commission accrual note; bank match in Finance |

Folio status: `OPEN | CLOSED | VOID | PENDING_AR | TRANSFERRED_AR`.

## Decision

### D1 — Lifecycle for company/agency balance at checkout

Add **operational** folio AR phase in hotel (not GL):

```
OPEN → (checkout) → PENDING_AR | CLOSED
PENDING_AR → TRANSFERRED_AR (invoice/handoff event) → (Finance Paid) reflected via inbound/reconcile
```

- **CLOSED** when guest ledger settled to zero (cash/card/deposit/loyalty).
- **PENDING_AR / TRANSFERRED_AR** only for COMPANY/AGENCY folios with approved credit (active contract + limit).
- Guest personal folios cannot leave balance on CL.

Exact Prisma enum naming is an implementation detail of the FO money wave; this ADR locks the product meaning.

### D2 — City Ledger modules (hotel vs Finance)

| Module | Hotel | Finance |
|--------|-------|---------|
| Corporate profile credit limit + payment terms | Limit enforce on checkout/transfer; terms display from contract/agency | Terms master + aging buckets |
| Routing / payment instructions | Stay-level + revenue-code rules (extend `FolioRoutingRule` / card UI) | — |
| Invoice matching (bank → N invoices) | — | Collections UI |
| Agency statement / CL snapshot | Ops totals + event | Reconciliation |

### D3 — FO money close wave IDs

Tracked in [BACKLOG-PRODUCTION.md](../../era-hotel-pms/doc/BACKLOG-PRODUCTION.md) **P5**:

| ID | Theme |
|----|-------|
| H-BL-40 | Transfer to City Ledger at checkout + credit/contract gate |
| H-BL-41 | Deposit apply / offset at settle & checkout |
| H-BL-42 | Folio payment refunds (guest + agency) |
| H-BL-43 | Checkout discounts (manual + automatic) |
| H-BL-44 | Night Audit polish (exceptions, no-show, trial) |
| H-BL-45 | Per-guest / selective folio close |
| H-BL-46 | Agency prepaid/postpaid settlement + commission |
| H-BL-47 | List filter enrichment standard (HOT parity with CLI-37) |
| H-BL-48 | Finance AR: terms, aging, invoice matching (Finance owner) |
| H-BL-49 | Unused-nights refund at early checkout — **not P5**; [hotel-early-checkout-unused-nights.md](./hotel-early-checkout-unused-nights.md) |

Coverage rows: `HOT-CL-*`, `HOT-CASH-*`, `HOT-CO-04` (STUB), `HOT-NA-01`, `HOT-AG-*`, `HOT-XFER-01`, `HOT-BEO-01` in [COVERAGE_MATRIX.md](../COVERAGE_MATRIX.md).

### D4 — Honesty rule

Do not mark City Ledger / Night Audit / deposit as SHIPPED until COVERAGE actor columns + UAT-SMOKE UI path match Opera-depth claims in product copy. Ops snapshot ≠ AR.

## Consequences

- Next implementation plan starts from P5 / HOT-* API rows, not from green DELIVERY checkboxes alone.
- Finance wave H-BL-48 can ship in parallel once hotel emits TRANSFERRED_AR / invoice handoff consistently.
- Banquets/transfers remain MVP unless Nafta expands S&C scope.

## References

- [HOSPITALITY_FINANCE_BOUNDARY.md](../HOSPITALITY_FINANCE_BOUNDARY.md)
- [hotel-fo-screen-chain.md](./hotel-fo-screen-chain.md)
- [era-hotel-pms/doc/clone-spec/05-folio-and-cash.md](../../era-hotel-pms/doc/clone-spec/05-folio-and-cash.md)
- [era-hotel-pms/doc/clone-spec/07-night-audit-and-reports.md](../../era-hotel-pms/doc/clone-spec/07-night-audit-and-reports.md)
- [era-hotel-pms/doc/KKM-POLICY-FOLIO-SETTLEMENT.md](../../era-hotel-pms/doc/KKM-POLICY-FOLIO-SETTLEMENT.md)
