# ADR: ERA Bank — GL account mapping (Product Factory + SystemGlConfig)

**Status:** Accepted (implemented 2026-07-16)
**Decision owners:** Platform architecture + banking domain.
**Related:** [era-bank-core.md](./era-bank-core.md) (D2 thin kernel, D6 money ACID) · [era-bank-risk-and-audit.md](./era-bank-risk-and-audit.md)
**Product docs:** [era-bank-core/TZ.md](../../era-bank-core/TZ.md) §2.1 / §2.6 · [OPEN-TASKS.md](../../era-bank-core/doc/OPEN-TASKS.md)

---

## Context

L2 modules (`loans`, `deposits`, `treasury`, `payments`, `cards`) and some kernel teller/branch paths posted money using **inline CBAR GL code literals** (e.g. `"1300101"`, `"2550201"`). Product templates already carried partial GL mapping in `paramsJson` (`glAssetCode`, `glLiabilityCode`), but services ignored it and used constants.

Forces:

1. **L3 config rule (ADR D2):** bank-specific product conditions must not live in code — rates, terms, **and product GL mapping** belong in Product Factory.
2. **Bank-wide control accounts** (nostro, FX transit, MFR, cash vault) are not product-scoped; they must be configurable per bank without redeploying module code.
3. **No parallel ledger:** GL resolution only picks `GlAccount` rows; postings still go through `kernel/posting-engine`.

## Decision

### G1 — Two resolution paths (product vs system)

| Kind | Source of truth | Resolver | Examples |
|------|-----------------|----------|----------|
| **Product GL** | `ProductTemplate.paramsJson` keys | `getProductGlCode(paramsJson, key)` in `apps/api/src/common/product-gl.ts` | Loan portfolio asset, term deposit liability, product interest income/expense |
| **System GL** | `SystemGlConfig` table (`bankOrgId` + `key` → `glCode`) | `SystemGlConfigService.resolve(key)` in `kernel/ledger/` | Cash vault, MFR, nostro/vostro, FX transit, interbank placement, GS, interest income/expense (bank-wide) |

Convention for `paramsJson` GL keys:

- `glAssetCode`
- `glLiabilityCode`
- `glInterestIncomeCode`
- `glInterestExpenseCode`

Canonical `SystemGlKey` values: `CASH_VAULT`, `MFR_SETTLEMENT`, `INTERBANK_PLACEMENT`, `FX_TRANSIT`, `NOSTRO`, `VOSTRO`, `GOV_SECURITIES`, `INTEREST_INCOME`, `INTEREST_EXPENSE`.

### G2 — Forbidden: inline GL code literals in posting builders

Modules and kernel teller/branch paths **must not** hardcode CBAR codes when building `PostingRequest` legs. Allowed exceptions:

- Seed / migration defaults that *populate* `GlAccount` and `SystemGlConfig`.
- Explicit API input that *selects* a GL (e.g. nostro registration `glAccountCode` provided by the caller).

### G3 — Kernel owns the system-GL registry

`SystemGlConfig` and `SystemGlConfigService` live under **L1 `kernel/ledger`** (ledger configuration, not product math). Product modules import `LedgerModule` and resolve keys; they do not own the mapping table.

## Consequences

**Positive**

- Banks re-map CBAR control accounts via seed/config without code changes.
- Product GL follows Product Factory (L3); changing a loan template’s asset GL changes disbursement/repay legs.
- Thin-kernel rule preserved: no product-specific GL math in L1; only named system keys.

**Negative / costs**

- Missing `paramsJson` key or `SystemGlConfig` row fails at post time (`NotFoundException` / validation error) — seed and Product Factory UI must keep mappings complete.
- Deployments need a migration for `system_gl_configs` + reseed.

## Alternatives considered

1. **Keep module constants.** Rejected: violates L3 config and blocks multi-bank COA variants.
2. **Only Product Factory for everything (including nostro/MFR).** Rejected: system accounts are not products; forcing fake templates is awkward.
3. **Env vars for system GL codes.** Rejected: not tenant-auditable and weaker than a DB mapping with seed/history.

## Implementation references

- Schema: `SystemGlConfig` in `era-bank-core/packages/database/prisma/schema.prisma`
- Migration: `packages/database/prisma/migrations/20260716220000_system_gl_config/`
- Resolver: `apps/api/src/kernel/ledger/system-gl-config.service.ts`
- Product helper: `apps/api/src/common/product-gl.ts`
- Consumers: `modules/loans`, `modules/deposits`, `modules/treasury`, `modules/payments`, `modules/cards`, `kernel/posting-engine/teller-posting.service.ts`, `kernel/branch/branch.service.ts`
- Seed: `packages/database/prisma/seed.ts` (system mappings + loan `glInterestIncomeCode`)
