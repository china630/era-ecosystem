# Hotel stage W2 — scaffold-gate-pass (BE deepen)

**Product:** hotel  
**Wave:** W2 BE scaffold green  
**Date:** 2026-08-04  
**Result:** `scaffold-gate-pass`

## Scope

Negative-path proof for in-scope ACs (FO, CASH, HK, RATE scoped, MDM).  
AC-HOT-INT remains STUB / Scaffold 🟡 and is excluded from Scaffold BE rollup.

## Evidence

| Check | Result |
|-------|--------|
| `npx jest --ci __tests__/p5-fo-money-negative.spec.ts __tests__/fo-gates-negative.spec.ts __tests__/mdm-negative.spec.ts __tests__/hk-status-negative.spec.ts` | PASS (26 tests) |
| DEPOSIT over-HELD refuse in `settleFolio` | code + test |
| Implementation-Matrix AC rollup (in-scope) | ✅ |
| Product-Readiness Scaffold BE | ✅ |
| UI / Demo / Pilot | still open (not this wave) |

## Gate script

```bash
node scripts/run-hotel-stage-gate.mjs
```

Manual UAT-SMOKE lab signoff remains open (S-2).

## Honesty

Scaffold-gate-pass ≠ Pilot-ready ≠ edition `ga`.  
Sell/show still blocked by UI/Demo/Pilot layers on Product-Readiness-Matrix.
