# Data Hub — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Data-Hub-Product-Readiness-Matrix.md`](./Data-Hub-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Data-Hub-Implementation-Matrix.md`](./Data-Hub-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ (scaffold only) · BE ✅ · UI n/a · Sell: do not claim GA — API product; pilot/field open  
**BE honesty (Wave 8):** Scaffold BE ✅ with AC-DH-VOEN **excluded from rollup** (e-taxes BLOCKED / External ⏸; stays Scaffold 🟡).

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | 🟡 | [ ] | `reports/data-hub-stage-W0-signoff.md` scaffold-gate-pass |
| Green-BE W4 | gate[x] | 🟡 | [ ] | REG/FX/BANK/HS Scaffold ✅; VOEN External kept BE 🟡 |
| Green-BE W8 | gate[x] | ✅ | [ ] | VOEN excl. from BE rollup (Hotel INT / e-taxes BLOCKED) |
| W1 honesty | gate[ ] | ✅ | [ ] | UAT lab signoff; close P0 residuals |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [x] | `scripts/run-data-hub-stage-gate.mjs` |
| S-2 | Pilot lab UAT-SMOKE signed | [ ] | `era-data-hub/doc/UAT-SMOKE.md` |
| S-3 | Field / customer sign-off | [ ] | — |
| S-4 | Green Scaffold BE Wave 8 (VOEN excl.) | [x] | IM + PRM; VOEN stays 🟡 External |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
