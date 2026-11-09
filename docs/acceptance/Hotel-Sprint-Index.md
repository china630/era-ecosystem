# Hotel — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Hotel-Product-Readiness-Matrix.md`](./Hotel-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Hotel-Implementation-Matrix.md`](./Hotel-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ · BE ✅ · UI ✅ · Demo ✅ · Sell: mvp showable — do not claim GA; Pilot open; KKM STUB  
**Overbook (2026-10-31):** type and house allowances default 0. HOT-FO-01/02 stay SHIPPED. AC-HOT-FO stays ✅. Does not change the rollup. `docs/editions/hotel.yaml` unchanged.
**Night audit → finance (2026-10-31):** queue accepts the night-audit correlation id. HOT-NA-01 stays SHIPPED. Does not change the rollup.

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | 🟡 | [ ] | `reports/hotel-stage-W0-signoff.md` scaffold-gate-pass |
| W1 P5 FO money | gate[x] | 🟡→✅ code | [ ] | COVERAGE SHIPPED for the signed cashier. 2026-10-27 MOVE_PAYER_CL + unsettled; room payer + gross/net; corp contract→COMPANY; HOT-CL-07 API; HOT-AG-01 contracts UI; folio signed ledger + open-debt payment gate (HOT-CASH-01 deepen; HOT-FOLIO-DESK still API). 2026-10-28 `ensureOpenCashShift` + pending receipt (HOT-CASH-02/06); NA stop-step reservation refs (HOT-NA-02); CL audit HOT-CL-06. 2026-10-29 HOT-AG-COMM-01…04 agency commission payable; folio Debit\|Credit + stay-wide lodging pay + Nafta revenue v2 remap scripts (HOT-CASH-01 deepen; HOT-FOLIO-DESK/HOT-REV-01 API); folio UI polish shipped #368/#369 (drop Sətir, Bu sətri ödə GUEST-only, EraMenu portal, short labels, PKG i18n) + staging label cleanup; AC-HOT-AG-COMM 🟡. 2026-11-01 paymentCategory pay + pocket + mid-stay category-refund + `__tests__/payment-category-pay.spec.ts`; Gate/Pilot/edition unchanged. **2026-11-03** FO corp+medical: keep Volkin/Merikl beside contract; allotment missing row → `NO_ALLOTMENT_BAR` hotel Avl; HOT-BOOK-02/FO-02/CL-01/AG-01 SHIPPED deepen; second-pass GroupBooking + package-switch clear + medical toast suppress + ADR; Gate/Pilot/edition unchanged. Pilot lab still needs UAT §27 1c re-sign / §29 1a–1b / §27c artifact |
| W2 BE scaffold green | gate[x] | ✅ (INT excl.) | [ ] | `reports/hotel-stage-W2-signoff.md` — negative-path suites |
| W3 UI / Demo | gate[x] | ✅ | [ ] | `reports/hotel-demo-te-signoff.md` — UI/Demo ✅; lab open. 2026-11-02 HOT-UI-01 FO reservations/in-house list polish (children, departed strike, Res.ID copy, party in-house); **2026-11-03** party channel + company in `q` + in-house Res.ID copy; Gate/Pilot/edition unchanged |

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
| S-10 | Nafta HK deepen (roster, floor sheet, `/hk/rooms`, laundry) | [~] | Engineering SCREEN — soft sort+room#; void IN_PLANT; laundry catalog + nullable/express unit prices + intake/due policy (`/settings/laundry-catalog`, policies#hk); FO amount; stay linen edit-only; maids edit/unlink; discrepancy create modal; playbook filter+one grid+one PRIMARY; kit `DATA_TABLE_SHELL` / `CARD_CONTAINER` on secondary HK (incl. consumption/minibar/mobile); i18n trio; [`HK-NAFTA-OPS.md`](../../era-hotel-pms/doc/HK-NAFTA-OPS.md); UAT-SMOKE §34 open; not SHIPPED. Does not move Gate, Pilot, or edition |
| S-11 | Nafta medical SKU dual-run (Wave A) | [~] | HOT-PKG-02 API; AC-HOT-PKG-NAFTA 🟡; leisure gate + agency table + FO pax SKU; **2026-11-03** FO keeps medical package beside corp Infotur contract + meal-agnostic OTAXHP list (HOT-BOOK-02 deepen; does not lift PKG to SHIPPED); **pilot punch open** |
| S-14 | Nafta composed package sell (Wave D) | [~] | HOT-PKG-03 API; AC-HOT-PKG-COMPOSE 🟡; save, night audit, and the open card share the compose; unfixed nights replaced; UAT §40 open |
| S-15 | Nafta per-pax lifecycle (Wave E) | [~] | HOT-PKG-04 API; check-in fan-out; outbox retries until ack; companion MDM id stays on that row; **pilot punch open**. Gate/Pilot/edition unchanged |
| S-16 | Reservation card IA D7 W1 | [~] | HOT-BOOK-04 API; ADR hotel-reservation-card-and-party-ops |
| S-17 | Depart guest (D7 W2) | [~] | HOT-FO-05 API; closed folio on a departed guest is not recreated; stay save keeps `departedAt`; UAT §43 open |
| S-18 | Family booking navigator (D7 W3) | [~] | HOT-BOOK-05 API |
| S-19 | Move guest / Swap rooms (D7 W4–W5) | [~] | HOT-FO-06/07 API; move dialog copy az/ru/en; UAT §44 open |
| S-20 | Keys / HK pickup polish (D7 W6) | [~] | HOT-FO-08 STUB — reissue-key task on Depart/Move/Swap |
| S-21 | Hotel RBAC Variant A + custom roles | [~] | AC-HOT-RBAC 🟡; `/settings/access` clone; system seed; UAT open — not Pilot |
| S-22 | Card right-pane Guests density | [~] | HOT-BOOK-06 API; **2026-11-03** party attach harden on HOT-BOOK-02 (guest-save no wipe; clicked-row place; party PATCH; second-pass refs/hydrate+counters/persist-fail toast) — UAT §45 open; AC-HOT-CARD-PANE 🟡; Gate/Pilot/edition unchanged |
| S-23 | Card Rate Grid + Folio chrome | [~] | HOT-BOOK-07/08 API |
| S-24 | Card Notes feed + alert | [~] | HOT-BOOK-09 API |
| S-25 | Category revenue code + day document v2 | [~] | AC-HOT-REV 🟡; HOT-REV-01 API; Nafta v2 + SatAdmin manual flags + seed PROCEDURE; one-shot remap scripts removed 2026-10-31; 2026-10-27 SQL seeds archive-only; not SHIPPED; out of BE and SHOW rollup |
| S-26 | e-qaimə hold on night audit | [~] | FIN-EQAIME-DAY-01 API; rule off by default; HOT-NA-01 stays SHIPPED; not SHOW |
| S-27 | Transfers/Tours boarding-first + Airport fold | [x] | HOT-XFER-01 / HOT-TOUR-01 SHIPPED SCREEN; AC-HOT-XFER/TOUR Scaffold ✅ out of BE rollup; UX closeout (list+modals, icon toolbar, bare print+letterhead); UAT §14/§14b; edition `mvp` unchanged |
| S-28 | Mutation audit Layer A belt (ecosystem standard) | [~] | Kit + `jsonOk` + `/admin/audit`; CI fail-closed; Wave B DAY_CLOSE; Wave E compound `(organizationId, createdAt)` 2026-10-29; HOT-AUD-01 / AC-HOT-AUD 🟡; hash-chain deferred; next = UAT; Nest API cutover is **P0 platform debt** ([industry-satellite-api-nest-migration](../adr/industry-satellite-api-nest-migration.md)) |
| S-29 | Department duty schedules (reception / security / engineering) | [~] | HOT-DUTY-01 / AC-HOT-DUTY 🟡; Schedules last before Settings; Workforce picker; UAT open — not SHIPPED/SHOW; out of BE/SHOW rollup; Gate/Pilot/edition unchanged |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`

**2026-11-05:** HOT-DUTY-01 department schedules closeout — COVERAGE API/SCREEN; IM AC-HOT-DUTY 🟡 out of BE rollup; PRM UI SCREEN 🟡 not SHOW; Gate/BE/Demo/Pilot/Edition/Sell unchanged; `hotel.yaml` `mvp` / `pilot_ready: false` untouched. Second-pass RBAC/i18n/binding harden — same statuses. `era-readiness-matrix` skipped (no consumer API/% flip).

**2026-11-06:** HOT-DUTY-01 UX deepen (chip assign, week chrome, copy week, axes settings) — still SCREEN / AC 🟡 / not SHOW; Gate/Pilot/edition/Sell unchanged; second-pass copy/axis harden — same statuses; `era-readiness-matrix` skipped.

**2026-11-10:** Schedules IA — section last before Settings; HK roster only under Schedules; P2002-safe binding/axes/week; settings collapsed; sidebar best-href. Still SCREEN / AC 🟡; Gate/Pilot/edition/Sell unchanged; `era-readiness-matrix` skipped.
