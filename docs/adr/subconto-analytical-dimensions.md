# ADR: Flexible subconto (analytical dimensions on journal lines)

**Status:** Accepted (Wave 3, 2026-07)  
**Scope:** `era-finance-core` — NAS ledger, standard GL reports

## Context

1C-style accounting expects up to three configurable analytical dimensions (*subconto*) per account, stored on **each journal line**, not only on document headers. ERA Finance previously exposed counterparty/department analysis from `Transaction` header fields only.

Wave 3 introduces:

- `SubcontoType` — org-scoped catalog (`COUNTERPARTY`, `COST_CENTER`, `EMPLOYEE`, `PROJECT`, `ITEM`, `CUSTOM`)
- `AccountSubcontoConfig` — up to 3 types bound per NAS account (with optional `required`)
- `JournalEntryDimension` — `valueId` / `valueRef` on `JournalEntry`

Posting write and validation are gated by **`ERA_SUBCONTO_ENABLED`** (default `false`). Config CRUD and reports are always available; when the flag is off, subconto report endpoints return an explanatory note and fall back to account-level aggregates where sensible.

## Decision

1. **Dimensions live on journal lines** via `JournalEntryDimension`, populated in `postJournalInTransaction` from `PostTransactionLine.dimensions[]` and/or auto-map from `Transaction.counterpartyId` / `departmentId` per `AccountSubcontoConfig`.
2. **IFRS mirror** copies dimensions to mirrored NAS→IFRS lines (`ifrsAutoMapping.mirrorFromNas`).
3. **Backfill** (`POST accounting/subconto/backfill-from-transactions`) idempotently copies header dims to lines for configured accounts when the flag is on.
4. **Reports** (new paths under `GET /reporting/subconto/*`):
   - `trial-balance` — OSV grouped by account + dimension value
   - `account-card` — card filtered by `subcontoTypeId` / `valueId`
   - `analysis` — drill-down totals per value for a subconto type
5. **UI:** `/reporting/subconto-analysis`; optional subconto filters on `/reporting/account-card` and `/reporting/turnovers`.

Wave 1 report paths (`/reporting/account-card`, `/reporting/account-turnovers`) remain unchanged for backward compatibility.

## Consequences

- Enabling the flag without account configs or backfill yields empty dimension reports (with fallback aggregates).
- Value display names resolve by `SubcontoKind` (counterparty decrypt, department/project/product names; employee shows id until MDM read-through is wired).
- Custom subconto uses `valueRef` as the human label when no catalog row exists.

## References

- Wave 3 plan: `.cursor/plans/wave3-depth-subconto-assets_bc95bef2.plan.md` (Blocks C, D)
- API: `apps/api/src/accounting/subconto.service.ts`, `apps/api/src/reporting/standard-reports.service.ts`
- COVERAGE: `FIN-SUBCONTO-*` in `docs/COVERAGE_MATRIX.md`
