# CRM — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Crm-Product-Readiness-Matrix.md`](./Crm-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Crm-Implementation-Matrix.md`](./Crm-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ (scaffold only) · BE ✅ · UI 🟡 · Sell: do not claim GA — pilot open  
**BE honesty (Wave 8):** Scaffold BE ✅ with AC-CRM-WA **excluded from rollup** (vendor External ⏸; stays Scaffold 🟡). TENANT still out.

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | 🟡 | [ ] | reports/crm-stage-W0-signoff.md scaffold-gate-pass |
| Green-BE W3 | gate[x] | 🟡 | [ ] | PIPE+PARTY Scaffold ✅; WA External kept BE 🟡 |
| Green-BE W8 | gate[x] | ✅ | [ ] | WA excl. from BE rollup (Hotel INT); TENANT still out |
| W1 honesty | gate[ ] | ✅ | [ ] | Close P0 residuals; UAT lab signoff |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [~] | `scripts/run-crm-stage-gate.mjs` |
| S-2 | Pilot lab UAT-SMOKE signed | [ ] | `era-crm/doc/UAT-SMOKE.md` |
| S-3 | Field / customer sign-off | [ ] | — |
| S-4 | Green Scaffold BE Wave 8 (WA excl.) | [x] | IM + PRM; WA stays 🟡 External |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
