# Finance — Green Scaffold BE Wave 6 signoff

**Date:** 2026-08-17  
**Scope:** Scaffold BE negatives for AC-FIN-GL, ARAP, INV, EVT, CFG, HR, TAX, FA  
**Not claimed:** UI ready, Demo/TE, Pilot lab/field, edition `ga`, `pilot_ready`

## Command

```bash
cd era-finance-core/apps/api
npm test -- --testPathPattern=negative --runInBand --forceExit
```

## Result

| Suite | AC | Status |
|-------|-----|--------|
| `__tests__/fin-gl-negative.spec.ts` | AC-FIN-GL | PASS |
| `__tests__/fin-arap-negative.spec.ts` | AC-FIN-ARAP | PASS |
| `__tests__/fin-inv-negative.spec.ts` | AC-FIN-INV | PASS |
| `__tests__/fin-evt-negative.spec.ts` | AC-FIN-EVT | PASS |
| `__tests__/fin-cfg-negative.spec.ts` | AC-FIN-CFG | PASS |
| `__tests__/fin-hr-negative.spec.ts` | AC-FIN-HR | PASS |
| `__tests__/fin-tax-negative.spec.ts` | AC-FIN-TAX | PASS |
| `__tests__/fin-fa-negative.spec.ts` | AC-FIN-FA | PASS |

**Totals:** 8 suites · 17 tests · all passed.

## Matrices

- Implementation-Matrix Scaffold BE rollup → ✅
- Product-Readiness: BE ✅ · UI 🟡 · Demo ❌ · Pilot `[ ]` · Sell unchanged (`mvp`)

## UAT

Deny checklist: [`era-finance-core/doc/UAT-SMOKE.md`](../era-finance-core/doc/UAT-SMOKE.md)
