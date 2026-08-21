# Wholesale — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Wholesale-Product-Readiness-Matrix.md`](./Wholesale-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Wholesale-Implementation-Matrix.md`](./Wholesale-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ · BE ✅ · UI 🟡 · Demo 🟡 · Sell: do not claim GA — pilot open

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | 🟡 | [ ] | `reports/wholesale-stage-W0-signoff.md` scaffold-gate-pass |
| W1 BE scaffold green | gate[x] | ✅ (TENANT excl.) | [ ] | Negative-path suites; TENANT out of BE rollup |
| W1 honesty | gate[ ] | ✅ | [ ] | UAT lab signoff; UI/Demo still 🟡 |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [x] | `scripts/run-wholesale-stage-gate.mjs` |
| S-2 | Pilot lab UAT-SMOKE signed | [ ] | `era-wholesale/doc/UAT-SMOKE.md` |
| S-3 | Field / customer sign-off | [ ] | — |
| S-4 | BE deepen → Scaffold ✅ (excl. TENANT) | [x] | IM + `__tests__/ws-*-negative.spec.ts` |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
