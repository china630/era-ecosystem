# ADR: ERA Bank — Product Factory paramsJson contract

**Status:** Accepted (2026-08-05)
**Related:** [era-bank-gl-account-mapping.md](./era-bank-gl-account-mapping.md) · [era-bank-core.md](./era-bank-core.md) · TZ §2.6

## Context

`ProductTemplate.paramsJson` was an untyped bag. Satellite UI used `rateApr` / fake kinds (`DEPOSIT`), while seed/engine used `rateAnnual` and `ProductKind`. Origination mostly ignored rates/terms from the template.

## Decision

### P1 — Typed contracts per `ProductKind`

Validated in `era-bank-core/apps/api/src/kernel/product-factory/product-params.ts` on create/activate/patch:

| Kind | Required keys | Optional |
|------|---------------|----------|
| `CURRENT` | `glLiabilityCode` | `overdraftAllowed` |
| `TERM_DEPOSIT` / `SAVINGS` | `termMonths`, `rateAnnual`, `glLiabilityCode` | `glInterestExpenseCode`, `adifEligible`, bands |
| `LOAN_ANNUITY` / `LOAN_DIFF` | `termMonths`, `rateAnnual`, `glAssetCode`, `glInterestIncomeCode` | bands |
| `CARD` | `scheme`, `cardType`, `dailySpendLimitMinor`, `atmDailyLimitMinor` | `perTxnMaxMinor` |

- `rateAnnual` is an **annual fraction** in `[0, 1]` (0.12 = 12%). UI may show % and convert.
- Band keys: `termMonthsMin`/`Max`, `rateAnnualMin`/`Max`.

### P2 — Strict apply-on-originate

ACTIVE template is source of truth for GL, currency, kind, scheme/limits. Rate/term: template default; request override only inside bands (else 400). Card limits may only be tightened ≤ product max.

### P3 — `moduleKey` derived from kind

`CURRENT`→`banking_core`, deposit kinds→`banking_deposits`, loan kinds→`banking_loans`, `CARD`→`banking_cards`.

## Consequences

- Product Factory UI and API share one contract; broken create payloads fail validation.
- Out-of-band rate/term requires `pricingException` + `exceptionReason` → `PENDING_PRICING_APPROVAL` with maker≠checker approve/reject (no silent override).
- Day-count conventions and FLOATING index+spread are first-class product params; contract snapshots rate at open/reset.
