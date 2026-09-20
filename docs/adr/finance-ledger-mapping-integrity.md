# ADR: Finance ledger mapping integrity (P0 Multi-GAAP)

**Status:** Accepted  
**Date:** 2026-09-07  
**Product:** ERA Finance (`era-finance-core`)

## Context

NAS→IFRS mirroring used two parallel mapping sources (`AccountMapping` with unused `ratio`, `IfrsMappingRule` used at runtime). Incomplete coverage caused a silent skip in `IfrsAutoMappingService` (NAS posted, no IFRS lines, no error). PRD claimed Multi-GAAP **COMPLETED** while IFRS chart bootstrap was largely a NAS clone plus demo accounts.

## Decisions

1. **SSOT:** versioned `LedgerMappingSet` + `LedgerMappingLine`. Legacy `AccountMapping` / `IfrsMappingRule` migrate into sets; write APIs return **410 Gone** after cutover.
2. **Incomplete coverage policy:** `Organization.settings.ledgerMirror.mode` = `soft` | `strict` (default **`soft`**). Soft: NAS commits, IFRS all-or-nothing omitted, `Transaction.mirrorStatus=FAILED`. Strict: abort entire post with `MISSING_IFRS_MAPPING`.
3. **No PARTIAL IFRS lines in P0:** only `NONE` | `POSTED` | `FAILED`.
4. **Provenance:** IFRS `JournalEntry` stores `sourceJournalEntryId` + `mappingLineId`; unique `(sourceJournalEntryId, ledgerType)` for idempotency.
5. **Pin published set** on the transaction at mirror time; publishing vN+1 does not rewrite historical POSTED txs.
6. **Honesty:** Multi-GAAP / IFRS mirror is **PARTIAL** until P1 (real IFRS chart, IFRS-only adjustments, per-book close). P0 is integrity infrastructure only.

## Consequences

- Entitlement `ifrsMapping` off → `mirrorStatus=NONE` (NAS-only).
- Soft FAILED queue + retry uses the **current** published set, live entitlement, and org `ledgerMirror.mode`.
- Soft fail / retry clears orphan IFRS lines (all-or-nothing).
- Onboarding bootstrap auto-publishes the first demo mapping set when none is published; further versions stay DRAFT until Publish.
- Publish validates 1:1 source lines + semantic types + active IFRS targets; returns coverage % (incomplete coverage is intentional soft policy).
- Automatic posting resolves a PUBLISHED set by the source `accountingBookId`; NAS prefers `NAS_TO_IFRS` and retains the legacy code fallback when book IDs have not been backfilled.
- One source book currently mirrors to one selected target per post. Multi-target fan-out needs a transaction-level status/provenance model and uniqueness beyond `(sourceJournalEntryId, ledgerType)`.
- MANAGEMENT / `AccountingBook` → **Accepted** ADR [finance-accounting-book.md](./finance-accounting-book.md) (slot billing + Waves A–C). P0 scope unchanged.

## P0 hardening (2026-09)

- Retry entitlement/mode fixed; orphan wipe; `TARGET_ACCOUNT_MISSING`; Prisma `@@unique([sourceJournalEntryId, ledgerType])`; legacy service writes → 410; Audit Hub presence SQL excludes `NONE`/`FAILED`.

## References

- Plan: P0 IFRS Integrity Gate (C+C)
- Engine: `apps/api/src/accounting/ifrs-auto-mapping.service.ts`
- TZ §12.1, PRD §5.C (downgraded to PARTIAL)
