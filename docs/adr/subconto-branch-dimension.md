# ADR: Subconto BRANCH multi-branch dimension

- **Status:** Accepted
- **Date:** 2026-07-13
- **Context:** Tender multi-branch reporting (Poçt / Rabitə / Teleötürücü) within one organization VOEN — not separate legal entities or separate official tax declarations.

## Decision

1. Use Finance **subconto** stack (`SubcontoType`, `AccountSubcontoConfig`, `JournalEntryDimension`) gated by `ERA_SUBCONTO_ENABLED`.
2. Seed system type `BRANCH` (`SubcontoKind.CUSTOM`) with canonical **valueRef** codes: `POCT`, `RABITE`, `TELE`.
3. Attach dimensions on NAS journal lines via `AccountingService.postJournalInTransaction` → `SubcontoService.applyDimensionsToJournalEntries`.
4. Filter/group via `GET /reporting/subconto-analysis?subcontoTypeCode=BRANCH&valueRef=POCT`.
5. Do **not** build separate official e-taxes declarations per branch (deferred; would be a heavier form-filter mechanism).

## Consequences

- Operational P&L / turnovers can split by branch without duplicating orgs.
- Official statutory forms remain org-level unless a future wave adds declaration filters.
- Related: [subconto-analytical-dimensions.md](./subconto-analytical-dimensions.md).
