# Hotel — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Hotel-Product-Readiness-Matrix.md`](./Hotel-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-04):** Negative-path suites landed — `__tests__/p5-fo-money-negative.spec.ts`, `fo-gates-negative.spec.ts`, `mdm-negative.spec.ts`, `hk-status-negative.spec.ts`. DEPOSIT over-HELD now refused in `settleFolio`.

**Seed hygiene (2026-09-22):** Boot `db:seed` is reference insert-if-missing only ([ADR satellite-seed-hygiene](../adr/satellite-seed-hygiene.md)); wipe/demo is `db:seed:demo`. Not implied as droplet boot. No Scaffold/ga change.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-HOT-FO | Front office screen chain (arrive/stay/depart) | ✅ | [ ] | `__tests__/fo-gates-negative.spec.ts` + HOT-FO/BOOK | Negative: Avl=0, DIRTY assign, names-incomplete, overlapping named guest |
| AC-HOT-FO-SHARE | Shared twin assignment (union gender pool) | ✅ | [ ] | `__tests__/shared-twin-negative.spec.ts` + HOT-FO-03 | T2; M/F only; N beds; vacated-bed reuse (`nextFreeShareBedIndex`); OTA exclusive; last-out DIRTY; break/cancel; HOT-FO-03 Status=API until UAT §30 |
| AC-HOT-CASH | FO money / City Ledger MVP | ✅ | [ ] | `__tests__/p5-fo-money-negative.spec.ts` + HOT-CASH/CO/CL; UAT §27 | Negative: CL gate, guest balance, DEPOSIT over-HELD, TRANSFERRED_AR refund, discount |
| AC-HOT-HK | Housekeeping + maintenance | ✅ | [ ] | `__tests__/hk-status-negative.spec.ts` | DIRTY not assignable; CLEAN/INSPECTED; **not** full Nafta deepen |
| AC-HOT-RATE | Dynamic rate plans (scoped) | ✅ | [ ] | ADR hotel-dynamic-rate-plans + pricing-engine tests | **Scope-cut:** BAR Excel HOT-02 = separate BLOCKED contour (not this AC) |
| AC-HOT-MDM | Guest MDM link + masked ops profile | ✅ | [ ] | `__tests__/mdm-negative.spec.ts` + guest-identity | Strict deny; masked ops-profile; invalid FIN merge schema |
| AC-HOT-CM | Channel Manager (Channex ARI + inbound + IBE) | 🟡 | [ ] | `__tests__/channel-manager-hardening.spec.ts` + `channel-manager-isolation.spec.ts` + `ota-ingest.spec.ts` | **Out of Scaffold BE rollup.** Negatives: unmapped UUID, CORS no `*`, IBE key header-only, hold deduct, dual ARI endpoints. HOT-CH-02 STUB until cert UAT. |
| AC-HOT-INT | Integrations (KKM, locks, B2C widget) | 🟡 | [ ] | HOT-03/04 STUB; HOT-06 HEADLESS (extension); Wave 6 lab SHOW for SuperAdmin policy + clinic Issue-ticket; Wave 8 ALS ingest stamps; Wave 9 field runbook | Explicit stub — **excluded from Scaffold BE rollup** (external ⏸). Lab: [`reports/hot06-lab-signoff.md`](../../reports/hot06-lab-signoff.md). Field: [`reports/hot06-field-runbook.md`](../../reports/hot06-field-runbook.md). Still not SHIPPED (field SPA Insert open). |
| AC-HOT-TENANT | SHARED pool: `organizationId` on ops rows | 🟡 | [ ] | CP-TENANT-01; kit fail-closed tenant extension; Wave 1 hotel session/JWT `enterSatelliteTenant`; Wave 4 cron `runCronForEachTenant` + `byOrganization`; Wave 5 lab `saas-wave5-two-org-isolation`; Wave 9 live pool smoke; Wave 10 cron User DISTINCT discover | **Excluded from Scaffold BE rollup.** Lab + live-smoke + cron discover available; still not Scaffold ✅ (field two-org UAT open). Signoff: [`reports/two-org-isolation-signoff.md`](../../reports/two-org-isolation-signoff.md) |
| AC-HOT-AGP | Agency portal (CP grant + PMS book + FO inbox) | 🟡 | [ ] | ADR hotel-agency-portal; HOT-AGP-01/02/03; `__tests__/agency-portal-negative.spec.ts` | Negatives landed (SSO HMAC + auto-confirm default OFF); Scaffold ✅ after fuller isolation suite + UAT §31 |
| AC-HOT-TOUR | Guest group tours (Nafta roster + TOUR folio) | ✅ | [ ] | ADR hotel-guest-tours; `__tests__/tours-money.spec.ts` + `tours-negative.spec.ts`; UAT-SMOKE §14b | **Out of Scaffold BE rollup** — Nafta add-on; not in FO/CASH worst-of. Edition stays `mvp`. |
| AC-HOT-PKG-NAFTA | Medical SKU resolve + notes import (Wave A) | 🟡 | [ ] | `__tests__/medical-package-resolve.spec.ts` + `reservation-notes-import-adapter.spec.ts`; ADR nafta-medical-sku-dual-run | **Out of Scaffold BE rollup** — dual-run Nafta; not FO money scaffold |
| AC-HOT-PKG-COMPOSE | Composed nightly sell mix (Wave D) | 🟡 | [ ] | `__tests__/nafta-package-compose.spec.ts`; HOT-PKG-03 | **Out of Scaffold BE rollup** |
| AC-HOT-PKG-PAX | Per-pax check-in events for multi-program stay (Wave E) | 🟡 | [ ] | HOT-PKG-04; `paxKey` on lifecycle payload | **Out of Scaffold BE rollup** — note under HOT-PKG; not FO scaffold flip |
| AC-HOT-CO-EARLY | Early unused-nights refund (net VAT, all folios) | 🟡 | [ ] | `__tests__/early-checkout-unused-nights.spec.ts` + HOT-CO-04 | **Out of Scaffold BE rollup** until fuller void/lump/CL negatives; does not reopen AC-HOT-CASH |
| AC-HOT-AMEND | Mid-stay product change + Manual Price bar | 🟡 | [ ] | `__tests__/stay-amendment-policy.spec.ts` + HOT-FO-04 | **Not Scaffold ✅** — field-intent Nafta FO; UAT §35 open |
| AC-HOT-DEPART-GUEST | Party Depart guest (stay remains IN_HOUSE) | 🟡 | [ ] | `__tests__/depart-guest-negative.spec.ts` (share 409, last-pax `needs_checkout`) + clinic `__tests__/guest-departed-moved.spec.ts` + HOT-FO-05 | **Out of Scaffold BE rollup** — ADR hotel-reservation-card-and-party-ops; UAT §43 open; orch fans out `GUEST_DEPARTED` |
| AC-HOT-PAX-MOVE | Move guest / Swap rooms within booking | 🟡 | [ ] | `__tests__/depart-guest-negative.spec.ts` (move group/empty/departed) + `__tests__/swap-rooms-negative.spec.ts` + HOT-FO-06/07 | **Out of Scaffold BE rollup** — UAT §44 open; orch fans out `GUEST_MOVED` |
| AC-HOT-RBAC | Configurable role×permission matrix + custom roles (Variant A) | 🟡 | [ ] | `hotel-rbac` + staff-provision unknown role; ADR hotel-domain-permissions-and-rbac; `/settings/access` | **Out of BE rollup** until field UAT; do not flip Scaffold ✅ without Pilot evidence |
| AC-HOT-CARD-PANE | Reservation card right-pane density (Guests / Rate Grid / Folio / Notes) | 🟡 | [ ] | HOT-BOOK-06…09; UAT §45–§48; Sprint S-22…S-24; `e2e/reservation-card.spec.ts` | **Out of Scaffold BE rollup** — UI density only; not SHIPPED until UAT; no Opera windows |

**Edition / wave rollup (BE, in-scope)** = worst(FO, CASH, HK, RATE, MDM) → **✅**.  
AC-HOT-INT remains 🟡 and is **out of Scaffold BE rollup** until vendor modes leave STUB.  
AC-HOT-TENANT is 🟡 (schema+filter) and stays **out of Scaffold BE rollup** (does not undo FO money scaffold).  
AC-HOT-AGP is 🟡 (P0–P1 landing) and stays **out of Scaffold BE rollup** until negative suite is green.  
AC-HOT-CO-EARLY is 🟡 and stays **out of Scaffold BE rollup**.  
AC-HOT-TOUR is Scaffold ✅ (negatives + UAT UI path) and stays **out of Scaffold BE rollup**.
AC-HOT-PKG-NAFTA is 🟡 and stays **out of Scaffold BE rollup**.
AC-HOT-PKG-COMPOSE is 🟡 and stays **out of Scaffold BE rollup**.
AC-HOT-PKG-PAX is 🟡 and stays **out of Scaffold BE rollup**.
AC-HOT-RBAC is 🟡 (Variant A shipped; field UAT open) and stays **out of Scaffold BE rollup**.

Do not call this table «product readiness» (UI / Pilot still separate).

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-HOT-RATE / HOT-02 | Nafta BAR Excel import | BLOCKED external | Scoped out of AC-HOT-RATE |
| AC-HOT-INT | Live KKM / locks / notify | External ⏸ | Keep STUB; max Scaffold 🟡 |
| HOT-RPT-01/02 | EW Management Reports catalog + nightly ZIP | W1–W3 code delivered (out of BE rollup) | Screens + PDF + ZIP + cubes + 3-year + email ZIP link; negative path `__tests__/hotel-reports-negative.spec.ts` (unknown slug / lang / empty pack) — Scaffold 🟡 not ✅; no AC-HOT-RPT ✅ |
| Nafta HK deepen | Roster/sheet/laundry/forecast/discrepancy/policy | Out of AC-HOT-HK rollup | SCREEN + `__tests__/hk-nafta.spec.ts`; UAT §34 open — do not call AC-HOT-HK «весь Nafta» |
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |
| HOT-CO-04 | Early checkout unused-nights refund (net VAT, default CASH) | Out of BE rollup | ADR Accepted; AC-HOT-CO-EARLY 🟡 until fuller negatives; SHIPPED OpsUI |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-hotel-pms/__tests__/p5-fo-money-negative.spec.ts` | AC-HOT-CASH |
| `era-hotel-pms/__tests__/fo-gates-negative.spec.ts` | AC-HOT-FO |
| `era-hotel-pms/__tests__/shared-twin-negative.spec.ts` | AC-HOT-FO-SHARE |
| `era-hotel-pms/__tests__/mdm-negative.spec.ts` | AC-HOT-MDM |
| `era-hotel-pms/__tests__/hotel-rbac.spec.ts` | AC-HOT-RBAC |
| `era-hotel-pms/__tests__/staff-provision.spec.ts` | AC-HOT-RBAC (unknown role) |
| `era-hotel-pms/__tests__/hk-status-negative.spec.ts` | AC-HOT-HK |
| `era-hotel-pms/__tests__/hk-nafta.spec.ts` | Nafta HK deepen (out of AC rollup) |
| `era-hotel-pms/__tests__/hotel-reports-negative.spec.ts` | HOT-RPT-01/02 |
| `era-hotel-pms/__tests__/channel-manager-hardening.spec.ts` | AC-HOT-CM |
| `era-hotel-pms/__tests__/channel-manager-isolation.spec.ts` | AC-HOT-CM |
