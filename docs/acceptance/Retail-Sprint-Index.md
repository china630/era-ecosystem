# Retail — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Retail-Product-Readiness-Matrix.md`](./Retail-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Retail-Implementation-Matrix.md`](./Retail-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ (scaffold only) · BE ✅ · UI 🟡 · Sell: do not claim GA — fiscal/marketplace field open  
**BE honesty (Wave 8):** Scaffold BE ✅ with AC-RET-FISCAL **excluded from rollup** (External ⏸ / STUB; stays Scaffold 🟡). TENANT still out.

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | 🟡 | [ ] | reports/retail-stage-W0-signoff.md scaffold-gate-pass |
| Green-BE W2 | gate[x] | 🟡 | [ ] | POS+STOCK Scaffold ✅; FISCAL External kept BE 🟡 |
| Green-BE W8 | gate[x] | ✅ | [ ] | FISCAL excl. from BE rollup (Hotel INT); TENANT still out |
| W1 honesty | gate[ ] | ✅ | [ ] | Close P0 residuals; UAT lab signoff |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [~] | `scripts/run-retail-stage-gate.mjs` |
| S-2 | Pilot lab UAT-SMOKE signed | [ ] | `era-retail-pos/doc/UAT-SMOKE.md` |
| S-3 | Field / customer sign-off | [ ] | — |
| S-4 | Green Scaffold BE Wave 8 (FISCAL excl.) | [x] | IM + PRM; FISCAL stays 🟡 External |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
