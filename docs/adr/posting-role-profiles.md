# ADR: Posting Role Profiles

## Status

Accepted (2026-05-23)

## Context

Auto-postings in ERA Finance used hardcoded NAS codes from `ledger.constants.ts` (commercial plan: 211, 601, 531, 721…). Chart of accounts is provisioned per `OrganizationKind` (COMMERCIAL, BUDGET, NGO) from separate JSON catalogs. The same numeric code has different meaning across kinds (e.g. BUDGET `211` is not trade receivable; BUDGET `531` is not supplier payable).

## Decision

Introduce a semantic layer:

1. **PostingRole** — stable slug (`TRADE_RECEIVABLE`, `PAYROLL_PAYABLE`, …).
2. **Presets** — `posting-roles-{commercial|budget|ngo}.json` seeded into `template_posting_roles`.
3. **Overrides** — `organization_posting_roles` editable by OWNER, ADMIN, ACCOUNTANT.
4. **PostingSchema** — declarative journal templates resolved via `PostingAccountResolver` and posted via `PostingJournalBuilder`.

### Defaults (v1, no accountant sign-off)

| Topic | Default |
|-------|---------|
| BUDGET invoice | Hybrid: gov-budget + smeta; paid services **111-1/111-2** + **611-1/611-2**; forbid auto-postings **211+601** |
| BUDGET payroll | Cr **307**; taxes **308-1/308-2**; Dr **711** or `BudgetLine.accountCode` |
| NGO COGS | `COGS_ON_SALE` only with stock issue (**721/205**); grants/donations use separate schemas |
| Migration | Greenfield — no historical journal rewrite |

### Caveat

MoF memorial-order account numbers (113, 180…) may differ from IPSAS-style `chart-of-accounts-budget.json`. v1 maps to **seeded catalog**; MoF alignment is backlog v2.

Source: [AZ budget organization instruction](https://frameworks.e-qanun.az/11/c_f_11191.html).

## Consequences

## v1.2 (2026-08-21) — official commercial cash/bank

Commercial catalog is **Q-01** (e-qanun 34909): **221 kassa**, **222 transit**, **223 bank settlement**. Do not rewrite the official chart onto NAS-GOV 101. `PostingRole` keys stay stable; `posting-roles-commercial.json` maps `CASH_AZN`→`221.01`, `MAIN_BANK`→`223`.

BUDGET remains NAS-GOV: kassa **101**, bank **103**. NGO İ-05: kassa **221**, bank **223**.

- COMMERCIAL Q-01 cash/bank mapping is in `posting-roles-commercial.json` (not a rewrite of the official chart).
- BUDGET/NGO auto-postings use kind-appropriate codes.
- Contract test: `validatePostingRolesAgainstCharts()` in CI (`packages/database/prisma/scripts/validate-posting-roles.ts`).

## v1.1 completion (2026-05-27)

- **Central guard:** `assertBudgetJournalLinesSafe` in `AccountingService.postJournalInTransaction`; override guard in `PostingRolesService.patch`.
- **Gov-budget ledger:** `POST /api/gov-budget/funding` (`BUDGET_APPROPRIATION`), `POST /api/gov-budget/expense-execution` (`BUDGET_EXPENSE_EXECUTION` + commitment).
- **NGO grants:** `POST /api/accounting/grant-receipts` (`NGO_GRANT_INCOME`).
- **Payroll BUDGET:** optional `budgetLineId` on salary registry `mark-paid` for expense debit from smeta line.
- **Demo seed:** `Demo NGO Foundation` alongside `Demo Budget Agency`.
- **MoF chart alignment** remains backlog v2 (accountant sign-off).
