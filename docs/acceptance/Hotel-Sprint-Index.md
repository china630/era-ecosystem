# Hotel — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Hotel-Product-Readiness-Matrix.md`](./Hotel-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Hotel-Implementation-Matrix.md`](./Hotel-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ · BE ✅ · UI ✅ · Demo ✅ · Sell: mvp showable — do not claim GA; Pilot open; KKM STUB

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | 🟡 | [ ] | `reports/hotel-stage-W0-signoff.md` scaffold-gate-pass |
| W1 P5 FO money | gate[x] | 🟡→✅ code | [ ] | COVERAGE SHIPPED; BE deepen in W2 |
| W2 BE scaffold green | gate[x] | ✅ (INT excl.) | [ ] | `reports/hotel-stage-W2-signoff.md` — negative-path suites |
| W3 UI / Demo | gate[x] | ✅ | [ ] | `reports/hotel-demo-te-signoff.md` — UI/Demo ✅; lab open |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [x] | W0 + W2 signoffs |
| S-2 | Pilot lab UAT-SMOKE signed | [ ] | `era-hotel-pms/doc/UAT-SMOKE.md` §27 + FO |
| S-3 | Field / customer sign-off | [ ] | — |
| S-4 | BE deepen → Scaffold ✅ (excl. INT stubs) | [x] | IM + `__tests__/*-negative.spec.ts` |
| S-5 | UI deepen → UI/Demo ✅ | [x] | `reports/hotel-demo-te-signoff.md` |
| S-6 | SHARED hotel pool isolation | [~] | AC-HOT-TENANT 🟡 — schema+filter; live pool / field UAT open |
| S-7 | Management reports catalog + Nafta nightly ZIP | [~] | W1–W3 API/SCREEN (P0 pack + P1 catalog + cubes/3-year + email ZIP link HEADLESS); HOT-RPT-01/02 not SHIPPED — no UAT evidence |
| S-8 | Agency portal P0–P1 | [~] | ADR hotel-agency-portal; AC-HOT-AGP 🟡; HOT-AGP-01/02/03 API |
| S-9 | Early checkout unused-nights refund (HOT-CO-04) | [x] | ADR Accepted; preview+apply+UI; UAT §33; AC-HOT-CO-EARLY 🟡 |
| S-10 | Nafta HK deepen (roster, floor sheet, laundry) | [~] | Waves 0–3 coded — [`era-hotel-pms/doc/HK-NAFTA-OPS.md`](../../era-hotel-pms/doc/HK-NAFTA-OPS.md); not SHIPPED (no UAT) |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
