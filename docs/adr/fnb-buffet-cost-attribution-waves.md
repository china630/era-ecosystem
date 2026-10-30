# Plan: F&B buffet cost attribution (waves)

**ADR:** [fnb-buffet-cost-attribution.md](./fnb-buffet-cost-attribution.md)  
**Status:** Open — Wave 0–6 code + acceptance closeout; UAT / Pilot / SHIPPED still open  
**Depends:** `fnb_buffet_planner` (plans UI landed) · `FIN-INV-SCOPE-01` (warehouse costClass + outlet code landed; chef UI scope later) · hotel day document (Nafta à-la-carte)  
**COVERAGE:** `FNB-BUFFET-COST-01` (API + SCREEN F&B forecast + Finance FOOD + non-FOOD budget; not SHIPPED)

Do not claim SHIPPED / SHOW / Pilot / `ga` until UAT evidence per wave.

---

## Wave 0 — Canon lock (docs only)

- [x] ADR accepted in `docs/adr/fnb-buffet-cost-attribution.md`
- [x] Link from [fnb-buffet-planner.md](./fnb-buffet-planner.md) + INTEGRATION E8 vs day document note
- [x] COVERAGE `FNB-BUFFET-COST-01` Doc (not API/SHIPPED); UI board **NONE**; IM/PRM honesty rows
- [x] Fnb Sprint-Index `S-BUFFET-COST` `[ ]`
- [x] Canonical wave plan in-repo (this file; `.cursor/plans/` is gitignored)

**Exit:** Docs point at ADR; no product claim change. ✅ 2026-10-28

---

## Wave 1 — Settings schema (F&B + Finance)

**Goal:** Per-outlet (and org defaults) for models without running cost math yet.

- [x] `buffetCostModel`: `HYBRID` | `RESIDUAL` | `THEORETICAL` | `POS_ONLY` | `OFF`
- [x] `staffBuffetOverlap`: `SEPARATE_CENTER` | `OVERLAP_PCT` | `LEFTOVER_FIRST` + `overlapPct` (default 30)
- [x] `cogsPostingMode`: `SALE_POST` | `DAY_DOCUMENT` | `ISSUE_TO_KITCHEN` | `PERIOD_END` (Nafta `hotelMode` default = `DAY_DOCUMENT`)
- [x] Warning thresholds (variance % band)
- [x] Org: `inventoryGtThresholdAzn` (default 500)
- [x] `stocktakePolicy` per class defaults (FOOD weekly, TABLEWARE 15d, …)
- [x] SatAdmin UI on `/admin/settings` — `CatalogField` kinds (Finance twin deferred to Wave 5/6)
- [x] i18n en/az/ru

**Exit:** Settings persist on `FnbOrgProfile.buffetCostSettingsJson`; `GET/PATCH /api/settings/buffet-cost`; effective slice on `/api/auth/me` (`buffetCost`); UAT draft step. ✅ 2026-10-28

---

## Wave 2 — Weekly template + management meal log (F&B)

**Goal:** Forecast covers stop lying; weekly pam-plan becomes first-class.

- [x] Weekly template (Mon–Sun × meal) → spawn/copy daily `BuffetPlan` instances
- [x] Management meal log: actor × date × meal × outlet × signature timestamp
- [x] Cover rollup API: plan + management (+ optional hotel later)
- [x] UI: template editor; management sign-in list/modal (tabs on `/admin/buffet`)
- [x] UAT steps; COVERAGE SCREEN; not SHIPPED

**Exit:** Chef can run a repeating week; management signatures visible in cover totals. ✅ 2026-10-28

---

## Wave 3 — Staff meal plan + overlap (F&B)

**Goal:** Staff plan exists; overlap rule is data, not spreadsheet folklore.

- [x] Staff meal plan entity (weekly slots × meal + optional dish lines)
- [x] Apply `staffBuffetOverlap` when exporting inputs to Finance cost run (`/staff-plans/cost-run-export`)
- [x] UI + i18n (`/admin/buffet` Staff meals tab)
- [x] Tests: no double-count of staff_net vs residual

**Exit:** Staff plan CRUD; overlap pct editable; unit tests for netting. ✅ 2026-10-28

---

## Wave 4 — Zero-price / comps attribution (F&B → Finance)

**Goal:** Price 0 lines carry COGS into COMP bucket, not silent residual.

- [x] Tag zero-price (or COMP tender) lines for cost run
- [x] Ensure recipe/cost available (warn if missing SKU)
- [x] Wire into attributed POS slice for cost run consumer

**Exit:** Comp COGS visible as named bucket in cost-run payload/fixture. ✅ 2026-10-28  
API: `GET|POST /api/admin/buffet/cost-run-export` → `pos.compAttributedAzn` + warnings; UI tab **Cost run / comps** on `/admin/buffet`. Unit COGS from `unitCogsBySku` / demo `defaultUnitCogsAzn` until Finance Wave 5.

---

## Wave 5 — Finance FOOD cost run + warnings

**Goal:** HYBRID report: usage, attributed, residual, theoretical, variance, warnings.

- [x] Resolve FOOD usage for outlet-scoped warehouses (`Warehouse.costClass` + `satelliteOutletCode` — FIN-INV-SCOPE-01 progress)
- [x] Cost run by period (default week, Asia/Baku)
- [x] Reliability flag if FOOD stocktake missing (`ISSUES_ONLY`)
- [x] Soft warnings vs thresholds (no auto buffet BOM issue)
- [x] Finance UI report + optional F&B deep-link
- [x] Specs: formula fixtures; Nafta department still uses day document for à-la-carte

**Exit:** Management can explain “why meat 750 vs TTK 1000” via variance; not SHIPPED until UAT. ✅ 2026-10-28 (API/SCREEN)  
Finance: `POST|GET /api/inventory/buffet-food-cost-run` · UI `/inventory/buffet-food-cost`. F&B Cost run tab deep-links when `NEXT_PUBLIC_FINANCE_WEB_URL` set.  
Scope edit: create + `PATCH /api/inventory/warehouses/:id` from Inventory settings (costClass / outlet); empty FOOD set → soft warning on run; week default = Asia/Baku Monday.

---

## Wave 6 — Forecast pack + non-food budget lines

**Goal:** Guest-nights bands × key SKUs; chem/consumable/tableware/inventory_gt plan/fact.

- [x] Hotel guest-nights (or manual) → forecast bands (`BuffetGuestNightEntry` + `/api/admin/buffet/guest-nights`; live hotel API later / `source=HOTEL`)
- [x] Key-SKU norm table (meat, oil, flour, …) in `buffetCostSettingsJson.forecastPack` + `/api/admin/buffet/forecast-pack`
- [x] Budget plan/fact rows for `CHEMICAL` | `CONSUMABLE` | `TABLEWARE` | `INVENTORY_GT` — Finance `POST|GET /api/inventory/outlet-budget-run` + `PATCH …/outlet-budget-plan`
- [x] Tableware stocktake cadence ~15 days in policy UI (hint + default `EVERY_15_DAYS`)
- [x] UAT draft step; Product-Readiness / COVERAGE update; still no `ga` without Pilot

**Exit:** Full budget picture beside food residual; edition unchanged unless Pilot signed. ✅ 2026-10-28 (API/SCREEN)  
F&B UI: `/admin/buffet` **Forecast pack** tab. Finance UI: `/inventory/buffet-food-cost` **Non-FOOD budget** tab.

---

## Post-wave UX — Phase A handoff (2026-10-28)

F&B `GET /api/admin/buffet/hybrid-handoff` + Cost run **Open Finance HYBRID** deep-link (`theoSku` + attributed + theoretical). Finance `/inventory/buffet-food-cost` parses handoff, autofills, auto-runs; Advanced JSON collapsed. Still SCREEN / UAT open — not SHIPPED.

## Post-wave UX — Phase B chef UX (2026-10-28)

F&B Forecast pack form (guest-nights CRUD, editable key SKUs/bands), Staff honesty (covers+overlap only), covers rollup card on plan composition, Cost run bucket console. Still SCREEN / UAT open — not SHIPPED.

## Post-wave UX — Phase C Finance polish (2026-10-28)

Finance `/inventory/buffet-food-cost`: kit Field form + handoff strip, HYBRID bucket cards + ISSUES_ONLY banner, Non-FOOD Field plan grid, WH `costClass` CatalogField + `#warehouses`. Still SCREEN / UAT open — not SHIPPED.

## Post-wave — Phase D lab demo seed (2026-10-29)

F&B `prisma/seed-buffet-demo.ts` + Finance `seed-buffet-food-wh.ts` (`npm run db:seed:buffet-demo`); SETUP runbook; chef UAT path; unsigned `reports/fnb-buffet-cost-lab-signoff.md`. Still SCREEN — not SHIPPED / not Demo ✅ until human signs.

## Chef-ready gap backlog (2026-10-29)

Product gaps to show a chef (API+BE+UI/UX kit canon) — not wave gates: [fnb-buffet-chef-ready-backlog.md](./fnb-buffet-chef-ready-backlog.md). Closing that backlog ≠ Demo ✅ / SHOW until Evidence Rules + human signoff.

## Explicitly later / out of this plan

- Seasonal template versioning
- `ISSUE_TO_KITCHEN` posting mode implementation
- Circular reuse ledger
- Tax GL = management residual
- Week bulk-copy beyond current plan copy

---

## Acceptance per wave

1. Update `docs/COVERAGE_MATRIX.md` actor rows for touched IDs.
2. Implementation-Matrix: no Scaffold ✅ without PRD AC + negatives.
3. Product-Readiness: worst-layer rollup; UI board NONE→SCREEN as screens land.
4. Sprint-Index / editions only if gate or sell claim changes.
5. `npm run check:acceptance` (strict before PR).
6. `era-readiness-matrix` only if consumer API levels / DELIVERY % change.
