# ADR: Finance per-book period close (P1 Multi-GAAP)

**Status:** Accepted  
**Date:** 2026-09-07  
**Product:** ERA Finance (`era-finance-core`)

## Context

P0 integrity gates NAS→IFRS mirroring. Period close and hard lock were org-global (`settings.reporting.closedPeriods`, `settings.ledger.lockedPeriodUntil`), so closing NAS also blocked IFRS-only adjustments.

## Decision

1. Closed months are stored per ledger:
   - `settings.reporting.closedPeriodsByLedger.NAS | .IFRS: string[]` (YYYY-MM)
   - Legacy `closedPeriods` kept in sync for **NAS** only (back-compat).
2. Hard lock date may be per ledger via `settings.ledger.lockedPeriodUntilByLedger`; legacy `lockedPeriodUntil` applies to NAS.
3. `POST /api/reporting/close-period` accepts `ledgerType` (`NAS` default | `IFRS`). Depreciation / intangible amortization run only on NAS close.
4. `postJournalInTransaction` and manual-adjustment preview use the **ledger being written**.

## Consequences

- Closing NAS does not close IFRS (and vice versa).
- IFRS Cash Flow includes bank CF items when a PUBLISHED `NAS_TO_IFRS` set exists.
- Multi-book generalization (`AccountingBook`, slots, Waves A–C): [finance-accounting-book.md](./finance-accounting-book.md).

## P1 hardening (2026-09)

- Dashboard close-period sends active `ledgerType`.
- Period-close checklist accepts `ledgerType` (NAS ops checks skipped/N/A on IFRS).
- Manual adjustment list/detail amounts use primary book (NAS, else IFRS-only).
- Adjustment templates map NAS posting roles → IFRS via PUBLISHED mapping.
- Org IFRS CoA bootstrap/provision gated on `ifrs_mapping` entitlement.
- Audit Hub reports `intentionalIfrsOnlyCount` for `mirrorStatus=NONE` IFRS-only txs.

## P1.5 close correctness (2026-09)

- Reverse / storno gated by **`closedPeriodsByLedger` for the book**, not shared `Transaction.isLocked`.
- IFRS month close locks **IFRS-only** txs (mirrored NAS+IFRS stay unlocked for NAS reverse).
- `GET close-period-prompt` / `period-status` accept `ledgerType`.
- `POST /reporting/reopen-period` unmerges month per ledger.
- TB / standard-report openings use that ledger’s closed calendar.
- `lockedPeriodUntilByLedger` write via period-lock API + active ledger in UI.
- Adj list filters by ledger; `canReverse` respects book closed month; template map warning.

## References

- Plan: P1 IFRS Product
- Utils: `apps/api/src/reporting/reporting-period.util.ts`
