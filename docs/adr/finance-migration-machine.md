# ADR: Finance migration machine (Upload + Assemble)

**Status:** Accepted  
**Date:** 2026-10-31  
**COVERAGE:** FIN-MIG-01  
**UI:** `/settings/migration`

## Context

Cutover from 1C/legacy must load masters and opening balances without free-form journal entry. The v1 Opening Balances Wizard (client-side XLSX + direct `POST /api/migration/opening-balances/*`) mixed create and post, allowed Excel employee create, and duplicated list import buttons.

## Decision

1. **Dual zone:** Upload (server Excel templates per kind) then Assemble (validate → one atomic post).
2. **Masters write-through** (counterparties, products, warehouses, recipes); keys VÖEN / sku / code / dishSku — existing keys are not updated.
3. **Drafts** stage in `MigrationDraftBatch` / `MigrationDraftLine` until assemble; locked after `migrationAssembledAt`.
4. **Tech account `000`** (EQUITY) balances opening posts; validate returns `trial000`.
5. **Workforce:** no Excel employee create; `POST /api/migration/workforce/pull` then HR drafts by `cpEmploymentId`.
6. **Open items:** `ar` → Invoice + JE; `ap` → JE (`OPENING-OPEN-ITEM-AP`) + `purchaseSnapshot.migrationOpening` on the Transaction (GL drives AP aging).
7. **Advances / city ledger:** PARTIAL — GL only; no hotel CL entity in Finance.
8. **VAT register:** Evidence only — draft rows, no GL on assemble; excluded from `trial000`.
9. **Legacy:** `POST /api/migration/opening-balances/{finance,hr,inventory}` → **410 Gone**.
10. **Permissions:** `api:migration.upload` / `api:migration.assemble` (OWNER, ACCOUNTANT). Mutations follow Nest Layer A audit belt (not on deny-list).

## Consequences

- UAT-SMOKE UI path required for SHIPPED / SHOW.
- Re-assemble and multi-currency openings are out of this edition.
- Pilot / edition `ga` remain separate from AC Scaffold.
