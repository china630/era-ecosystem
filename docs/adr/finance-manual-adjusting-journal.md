# ADR: Finance manual adjusting journal (əl ilə tənzimləmə)

**Status:** Accepted  
**Date:** 2026-08-20  
**Related:** [PRD.md](../../era-finance-core/PRD.md) §4.2 · [TZ.md](../../era-finance-core/TZ.md) §3.4 · AC-FIN-GL · AC-FIN-ARAP · AC-FIN-FA

## Context

Accountants need to correct balances **without editing posted documents**: over-collection refunds, one-sided write-offs, in-kind gifts (desk from home), founder instructions. Existing pieces (netting, quick-expense, manual bank, surplus) are domain-specific and do not require a durable “what and why” note. PRD already listed “Journal Vouchers”; there was no UI or public API.

## Decision (wave 1)

1. One document type `Transaction.kind = MANUAL_ADJUSTMENT` posted through existing `AccountingService.postTransaction` (balanced NAS lines, closed-period guard, IFRS mirror).
2. Posted transactions are **immutable** in v1 — no edit/storno of the voucher itself; corrections are further vouchers.
3. Field **`reason` is required** (min 10 characters) for this kind. Templates (`FREEFORM`, `AR_OVERCOLLECTION_REFUND`, `AR_WRITEOFF`, `AP_WRITEOFF`, `DONATION_IN_KIND`) are UX hints that prefill account pairs; they are not separate entities.
4. Optional `counterpartyId`, `departmentId`, `basisInvoiceId` are **links only** — invoices, payments, FA cards, and stock are not mutated by the free-form voucher alone.
5. Roles: `OWNER` / `ADMIN` / `ACCOUNTANT`. `USER` is denied (`assertMayPostManualJournal` + `@Roles`).
6. UI: `/accounting/adjustments` + modal on `SalesModalShell`. Registry lists only `MANUAL_ADJUSTMENT`.

## Decision (wave 2)

1. **Invoice credit adjustment (internal remaining):** `POST /api/invoices/:id/credit-adjustment` — in one DB transaction: `postJournalInTransaction` (Dr `SALES_REVENUE` or `MISC_OPERATING_EXPENSE` / Cr `TRADE_RECEIVABLE`), `InvoicePayment.kind = CREDIT_ADJUSTMENT`, `paidAmount` increment, status refresh. Original invoice lines and SENT journal are **not** edited. No PDF / e-qaimé credit note.
2. **Overpayment after full pay:** not this endpoint — cash/bank + `AR_OVERCOLLECTION_REFUND` on `/accounting/adjustments`; portal may still show original total.
3. **FA in-kind (donation):** `FixedAssetCreditSource.DONATION` on acquire → Dr `FIXED_ASSET_COST` / Cr `DONATION_REVENUE`; mandatory `note` (≥ 10) → `Transaction.reason`, `kind = MANUAL_ADJUSTMENT`, `basisFixedAssetId`. Template `DONATION_IN_KIND` on adjustments remains GL-only (hint in UI).
4. **Basis linkage:** `Transaction.basisInvoiceId` / `basisFixedAssetId` for traceability; adjustments registry shows invoice number or FA inventory number.

## Out of scope (v1 + wave 2)

PDF credit note to client; e-qaimé credit document; new stock adjustment module; draft/approval workflow; storno of original journal lines; mutating invoice `totalAmount`.

## Decision (wave 3)

1. **VAT split on credit-adjustment (variant A):** when `offset=REVENUE` and org is VAT payer with invoice VAT, proportional **Dr 601 (net) + Dr 545 (vat) + Cr 211 (gross)** mirrors SENT recognition ratio. `offset=EXPENSE` stays **Dr 731 / Cr 211** on gross only (no 545 rollback).
2. **Reverse own adjustment:** `POST /api/accounting/manual-adjustments/:id/reverse` — mirror NAS lines, `Transaction.reversesTransactionId` (unique). If linked `InvoicePayment.kind=CREDIT_ADJUSTMENT`, create `CREDIT_ADJUSTMENT_REVERSAL`, decrement `paidAmount`, refresh status. Block FA donation ACQUISITION reverse (use lifecycle dispose).
3. **Certificate PDF (not credit note):** `GET …/:id/pdf` — internal «бухгалтерская справка» with disclaimer; not e-qaimé / client credit note.
4. **Preview + copy:** `POST …/preview` (validate without write); `GET …/:id`; registry **Copy** prefills lines/template, empty reason. **Required `counterpartyId`** on `AR_*` / `AP_WRITEOFF` templates.
5. **Navigation:** basis column links to invoice (`?invoice=`) or FA (`?asset=`); invoice payments show voucher link + PDF; FA lifecycle shows journal ref; PAID overpayment CTA → `AR_OVERCOLLECTION_REFUND` prefilled modal.

## Out of scope (wave 3)

Client PDF credit note; e-qaimé; edit SENT journal; mutate `Invoice.totalAmount`; reverse FA capitalization via this API (dispose only).

## Consequences

- Accountants get a first-class GL voucher with audit (`AuditMutationInterceptor` → `JournalEntry`).
- Invoice aging / remaining stay consistent via `InvoicePayment` rows tied to credit-adjustment journals.
- Netting / bank / surplus remain for their domains; catch-all vouchers keep mandatory narrative.
- Scaffold proof: `fin-gl-negative.spec.ts`, `fin-arap-negative.spec.ts` (credit-adjustment), `fin-fa-negative.spec.ts` (DONATION note).
