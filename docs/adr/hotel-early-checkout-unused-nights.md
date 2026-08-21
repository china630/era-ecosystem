# ADR: Hotel early checkout — unused nights refund (Nafta)

**Status:** Accepted — 2026-08-21  
**Scope:** `era-hotel-pms` checkout / folio. Cashier ops. Not clinic cash. Not card hold/preauth.

Related: [hotel-city-ledger-and-fo-money.md](./hotel-city-ledger-and-fo-money.md) · [HOSPITALITY_FINANCE_BOUNDARY.md](../HOSPITALITY_FINANCE_BOUNDARY.md) · `early-checkout-unused-nights.service.ts`

## Context

Nafta stays are typically prepaid. Guest may leave before `checkOutDate`. House practice: refund unused nights **net of 18% VAT**, default **CASH**; apply on **all folio types** (GUEST cash refund; COMPANY/AGENCY = smaller AR after reverse).

Not H-BL-09 hour fees; not H-BL-42 payment-row refund alone.

## Decision

### D1 — Trigger

Actual departure calendar date (Asia/Baku) **before** `checkOutDate` → unused nights = `[departure, checkOut)`.

### D2 — Folio corrections

Void nightly lodging (`ROOM` / package / `PKG`…) on unused `businessDate`s on **any OPEN folio**. Non-medical check-in **lump**: partial void + repost remaining qty. Do not reverse F&B/extras/clinic hub.

### D3 — Refund amount

`refundNet = floor(unusedSellGross / 1.18, 2)` (house-favoring). Guest cash = guest share of unused gross × refundNet / gross. COMPANY/AGENCY: reverse only, no auto-cash to agency.

### D4 — Tender

Default **CASH**; CARD only if cashier selects. Reason optional/manager.

### D5 — Placement in checkout

After late fee (H-BL-09), **before** deposit apply and zero-balance / CL transfer.

### D6 — Waves

| Wave | Status |
|------|--------|
| W0 docs | done |
| W1 preview API | **done** |
| W2 post on checkout | **done** |
| W3 checkout UI | **done** |

## Out of scope

Clinic hold/preauth; live card auto-reversal; changing H-BL-09.

## COVERAGE

`HOT-CO-04` — SHIPPED after UAT §33 UI path (screens landed).
