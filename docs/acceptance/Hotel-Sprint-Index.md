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
| S-10 | Nafta HK deepen (roster, floor sheet, laundry) | [~] | Engineering SCREEN — [`HK-NAFTA-OPS.md`](../../era-hotel-pms/doc/HK-NAFTA-OPS.md); UAT-SMOKE §34 open; not SHIPPED |
| S-11 | Nafta medical SKU dual-run (Wave A) | [~] | HOT-PKG-02 API; AC-HOT-PKG-NAFTA 🟡; leisure gate + agency table + FO pax SKU; **pilot punch open** |
| S-14 | Nafta composed package sell (Wave D) | [~] | HOT-PKG-03 API; AC-HOT-PKG-COMPOSE 🟡; sell-versions catalog + main-SKU night audit; UAT §40 open |
| S-15 | Nafta per-pax lifecycle (Wave E) | [~] | HOT-PKG-04 API; check-in fan-out; **pilot punch open** |
| S-16 | Reservation card IA D7 W1 | [~] | HOT-BOOK-04 API; ADR hotel-reservation-card-and-party-ops |
| S-17 | Depart guest (D7 W2) | [~] | HOT-FO-05 API; UAT §43 open |
| S-18 | Family booking navigator (D7 W3) | [~] | HOT-BOOK-05 API |
| S-19 | Move guest / Swap rooms (D7 W4–W5) | [~] | HOT-FO-06/07 API; UAT §44 open |
| S-20 | Keys / HK pickup polish (D7 W6) | [~] | HOT-FO-08 STUB — reissue-key task on Depart/Move/Swap |
| S-21 | Hotel RBAC Variant A + custom roles | [~] | AC-HOT-RBAC 🟡; `/settings/access` clone; system seed; UAT open — not Pilot |
| S-22 | Card right-pane Guests density | [~] | HOT-BOOK-06 API |
| S-23 | Card Rate Grid + Folio chrome | [~] | HOT-BOOK-07/08 API |
| S-24 | Card Notes feed + alert | [~] | HOT-BOOK-09 API |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
