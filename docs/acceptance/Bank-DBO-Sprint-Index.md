# Bank DBO — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Bank-DBO-Product-Readiness-Matrix.md`](./Bank-DBO-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Bank-DBO-Implementation-Matrix.md`](./Bank-DBO-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ · BE ✅ · UI ✅ · Demo ✅ · Pilot lab [x] · Pilot field [ ] · edition `mvp` · Sell: channel lab-pilot ≠ ga · parent Inventory OUT not included  
**Parent scope:** [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md)

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | ✅ | [ ] | `reports/bank-dbo-stage-W0-signoff.md` scaffold-gate-pass |
| YC-B3 DBO UI | gate[x] | ✅ | [ ] | ASAN stub badge + negative UAT paths |
| YC-C2 TE | gate[x] | ✅ | [ ] | `reports/bank-dbo-te-demo-signoff.md` |
| YC-D2 Pilot lab | gate[x] | ✅ | [x] lab | `reports/bank-dbo-pilot-lab-signoff.md` |
| YC-E3/E7 | gate[ ] | ✅ | [ ] | ⏸ live ASAN / field |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [x] | `scripts/run-bank-dbo-stage-gate.mjs` |
| S-2 | Pilot lab UAT-SMOKE signed | [x] | `reports/bank-dbo-pilot-lab-signoff.md` |
| S-3 | Field / customer sign-off | [ ] | YC-E7 |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
