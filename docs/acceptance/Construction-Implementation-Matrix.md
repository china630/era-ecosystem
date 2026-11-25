# Construction — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Construction-Product-Readiness-Matrix.md`](./Construction-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Negative-path suites landed — `__tests__/con-prj-negative.spec.ts`, `con-mat-negative.spec.ts`, `con-plat-negative.spec.ts`.

**Civil date controls (2026-10-31):** Field-ops work date and daily-log date are kit `DatePicker`. Form values stay `YYYY-MM-DD`. Does not reopen AC-CON-PRJ Scaffold ✅. Pilot-ready stays `[ ]`.

**Closeout (2026-11-17 boundaries + M13 lines):** ADR [construction-domain-boundaries](../adr/construction-domain-boundaries.md). CN-ACT-LINES-01 API. AC-CON-ACT-LINES 🟡 **out of BE rollup** (unit negative only; no OpsUI; not Scaffold ✅). Does not reopen AC-CON-PRJ. Pilot-ready stays `[ ]`.

**Closeout (2026-11-17 Wave 1 scaffold):** CN-W1-SCAFFOLD-01 STUB. AC-CON-W1-SCAFFOLD 🟡 **out of BE rollup** (models + Nest list/create + empty UI shells; no workflow negative suite). Does not reopen AC-CON-PRJ. Pilot-ready stays `[ ]`.

**Closeout (2026-11-17 Wave 1 second-pass):** `deletedAt` filters on list/find + scaffold shell GET counts. Status stays 🟡 out of BE rollup — not Scaffold ✅. Pilot-ready stays `[ ]`.

**Closeout (2026-11-17 Wave 2 MVP):** Vertical slice project→BOQ→act lines→approve→Finance. CN-ACT-LINES-01 OpsUI SCREEN. AC-CON-ACT-LINES stays 🟡 **out of BE rollup** (unit negatives expanded; no HTTP suite / UAT — not Scaffold ✅). Does not reopen AC-CON-PRJ. Pilot-ready stays `[ ]`.

**Closeout (2026-11-17 Wave 2 second-pass):** approve amount≤0 refuse; draft-lines dirty guard; requisitions CatalogField. AC-CON-ACT-LINES stays 🟡 out of BE rollup. Pilot-ready stays `[ ]`.

**Closeout (2026-11-18 Wave 3 depth):** CN-W3-DEPTH-01 API+SCREEN. AC-CON-W3-DEPTH 🟡 **out of BE rollup** (unit negatives in `con-w3-depth.spec.ts`; no HTTP suite / UAT — not Scaffold ✅). Pilot-ready stays `[ ]`.

**Closeout (2026-11-18 Wave 3 second-pass):** pin SUPERSEDED refuse; legal punch options UI; field-ops sibling CatalogField; crewByPartyJson; orgId stamp. AC-CON-W3-DEPTH stays 🟡 out of BE rollup (unit negatives only — not Scaffold ✅). Pilot-ready stays `[ ]`.

**Closeout (2026-11-18 Wave 4 product):** CN-W4-PRODUCT-01 API+SCREEN hub. AC-CON-W4-PRODUCT 🟡 **out of BE rollup** (`con-w4-product.spec.ts` unit negatives; no HTTP suite / UAT — not Scaffold ✅). Pilot-ready stays `[ ]`.

**Closeout (2026-11-18 Wave 4 second-pass):** FORBIDDEN client UX siblings; submittal Reject/REVISE→IN_REVIEW; phase/location create error shape; claim amount>0 UI; UAT-SMOKE hub paths. AC-CON-W4-PRODUCT stays 🟡 out of BE rollup — not Scaffold ✅. Pilot-ready stays `[ ]`.

**Closeout (2026-11-23 Pilot W2–W4 second-pass):** Draft/approve stamp `financeContractId` from project; materials SEARCHABLE + hub-off free-text; TZ/PRD/M13–M21 sync; PayApp-ref negatives. AC stay 🟡 **out of BE rollup** — not Scaffold ✅. Pilot-ready `[ ]`; `pilot_ready: false`. No SHOW/`ga`.

**Closeout (2026-11-23 Pilot W2–W4):** SOV/journal verify UX; `financePayAppId` soft ref + materials soft-ref; UAT bridge/W3/W4 + Demo TE + signoff templates. AC-CON-EST / SMETA-RATE / ACT-LINES / TENANT / RBAC stay 🟡 **out of BE rollup** — not Scaffold ✅. Pilot-ready `[ ]`; `construction.yaml` `pilot_ready: false`. No SHOW/`ga`.

**Closeout (2026-11-23 Wave 1 second-pass):** Nest APPROVED transition returns `sovSeedEligible`+`financeContractId`; act 409→`actApprovedLocked`; ops nav Rate bases; approve banners mention plan-fact refresh. AC-CON-EST / AC-CON-SMETA-RATE / AC-CON-ACT-LINES stay 🟡 **out of BE rollup** — not Scaffold ✅. Pilot-ready stays `[ ]`. `construction.yaml` untouched.

**Closeout (2026-11-23 Wave 1 pilot contour UX):** Rate-bases amount>0 + readable items; Estimate status i18n + approve SOV/BOQ banners + rate SKU-off note; act lines sum preview + Finance bridge copy + APPROVED lock. AC-CON-EST / AC-CON-SMETA-RATE / AC-CON-ACT-LINES stay 🟡 **out of BE rollup** (UAT-SMOKE Wave-1 path described; unsigned — not Scaffold ✅). Pilot-ready stays `[ ]`. `construction.yaml` untouched.

**Closeout (2026-11-23 pilot intake anket deepen):** Field hints + spelling in Word/MD/generator. No AC row. No Scaffold ✅. Pilot-ready stays `[ ]`.

**Closeout (2026-11-20 pilot intake anket):** Docs-only AZ intake questionnaire. No AC row opened/closed. No Scaffold ✅. Pilot-ready stays `[ ]`.

**Closeout (2026-11-20 smeta rate-engine second-pass):** Estimate empty-base hint → `/admin/rate-bases`; PRD M21 + TZ routes. AC-CON-SMETA-RATE stays 🟡 **out of BE rollup**. No Scaffold ✅. Pilot-ready stays `[ ]`. `construction.yaml` untouched.

**Closeout (2026-11-20 smeta rate-engine MVP):** AC-CON-SMETA-RATE 🟡 **out of BE rollup** (`con-smeta-rate-negative.spec.ts`; API+SCREEN; SKU seed). No Scaffold ✅. Pilot-ready stays `[ ]`. `construction.yaml` untouched.

**Closeout (2026-11-20 smeta / budget / materials debt):** AC-CON-SMETA-RATE 🟡 **out of BE rollup** (ADR + COVERAGE Doc only; no API/negatives). No Scaffold ✅. Pilot-ready stays `[ ]`. `construction.yaml` untouched.

**Closeout (2026-11-20 SOV seed second-pass):** orch `isSatelliteEvent` includes estimate + change-request; project `financeContractId` fallback on approve; pack create persists contract link. AC-CON-EST stays 🟡 out of BE rollup (`estimate-csv-and-sov-hint` fallback case). No Scaffold ✅. Pilot-ready stays `[ ]`. `construction.yaml` untouched.

**Closeout (2026-11-20 SHARED + estimate SOV seed):** SHARED is product default (Acceptance/PR/module-map). CN-EST-01: approve event `lines[]` + Finance `seedSovFromEstimatePackage`; CSV import; financeContractId UI. AC-CON-EST / AC-CON-TENANT stay 🟡 out of BE rollup (`estimate-csv-and-sov-hint`, `estimate-sov-seed`, `con-tenant-shared`; UAT open — not Scaffold ✅). Pilot-ready stays `[ ]`. `construction.yaml` untouched.

**Closeout (2026-11-20 estimate hierarchy M20):** ADR construction-estimate-hierarchy. CN-EST-01 API+SCREEN. AC-CON-EST 🟡 **out of BE rollup** (`con-est-negative.spec.ts`; no HTTP suite / UAT — not Scaffold ✅). Pilot-ready stays `[ ]`.

**Closeout (2026-11-20 estimate second-pass):** UI ApiResult unwrap + SKU hint; i18n access/storefront; seed sync. AC-CON-EST stays 🟡 out of BE rollup — not Scaffold ✅. Pilot-ready stays `[ ]`.

**Closeout (2026-11-20 Nest Controllers edge):** Domain `/api` on native Nest Controllers (`nest/native`); generator retired; Nest edge without `next/*` (Express cookie TTL ms fix). Hosting/infra only — no AC Scaffold ✅ flip; Pilot-ready stays `[ ]`. ADR construction-nest-native-controllers.

**Closeout (2026-11-18 staff bridge + BIM polish):** CN-STAFF-01 API + CN-BIM SKU/URL polish. No new Scaffold ✅; Pilot-ready stays `[ ]`.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-CON-PRJ | Project + BOQ stub + progress act approve event | ✅ | [ ] | `__tests__/con-prj-negative.spec.ts` | Negative: module gate 403; APPROVED reopen refused |
| AC-CON-MAT | Material requisitions + plan vs actual | ✅ | [ ] | `__tests__/con-mat-negative.spec.ts` | Negative: module gate; missing project |
| AC-CON-PLAT | Platform add-ons on progress act / requisition | ✅ | [ ] | `__tests__/con-plat-negative.spec.ts` | Negative: module gate; cron secret unauthorized |
| AC-CON-ACT-LINES | Progress act ops SOV lines + richer approve payload (PRD M13) | 🟡 | [ ] | `__tests__/progress-act-lines.spec.ts` | **Out of BE rollup.** CN-ACT-LINES-01 API+SCREEN; empty/APPROVED/bad BOQ/amount≤0 refuse; Wave-1 UI sum/lock/Finance + 409 i18n; UAT-SMOKE Wave-1 unsigned — not Scaffold ✅ |
| AC-CON-W1-SCAFFOLD | Wave 1 full satellite skeleton (parties/phases/locations/RFI/submittal/inspection/change) | 🟡 | [ ] | schema + Nest stubs + rbac catalog v3 | **Out of BE rollup.** CN-W1-SCAFFOLD-01 STUB; phases/locations remain; depth moved to AC-CON-W3-DEPTH |
| AC-CON-W3-DEPTH | Wave 3 ops depth (parties, CDE supersede, field, RFI/submittal/change, inspection→punch) | 🟡 | [ ] | `__tests__/con-w3-depth.spec.ts` | **Out of BE rollup.** CN-W3-DEPTH-01 API+SCREEN; status 409s + pin SUPERSEDED 400; UAT open — not Scaffold ✅ |
| AC-CON-W4-PRODUCT | Wave 4 product hub (structure/schedule/equipment/claims + status machines) | 🟡 | [ ] | `__tests__/con-w4-product.spec.ts` | **Out of BE rollup.** CN-W4-PRODUCT-01 API+SCREEN; claim/req/gantt negatives; UAT open — not Scaffold ✅ |
| AC-CON-EST | Five-level estimate pack + dual mode + approve→BOQ + Finance SOV seed (PRD M20) | 🟡 | [ ] | `__tests__/con-est-negative.spec.ts` + `estimate-csv-and-sov-hint.spec.ts`; Finance `estimate-sov-seed.spec.ts` | **Out of BE rollup.** CN-EST-01 API+SCREEN; CSV; HTTP `sovSeedEligible` on APPROVED; Wave-1 banners; UAT-SMOKE Wave-1 unsigned — not Scaffold ✅ |
| AC-CON-SMETA-RATE | Smeta rate-engine MVP (org rates → estimate lines; Construction SKU) | 🟡 | [ ] | `__tests__/con-smeta-rate-negative.spec.ts`; COVERAGE CN-SMETA-RATE-01 | **Out of BE rollup.** API+SCREEN (`/admin/rate-bases` + ops nav + Estimate apply); unitAmount>0; Wave-1 UX; UAT-SMOKE Wave-1 unsigned — not Scaffold ✅ |
| AC-CON-TENANT | SHARED default: `organizationId` on ops rows + kit tenant extension | 🟡 | [ ] | CP-TENANT-01; kit tenant extension; UAT-SMOKE §tenancy | **Excluded from Scaffold BE rollup.** SHARED is the product default; schema+filter landed; lab two-org steps in UAT — not Scaffold ✅ until field proof |
| AC-CON-RBAC | Configurable role×permission matrix + custom roles (Variant A) | 🟡 | [ ] | `construction-rbac` + `construction-rbac-doors` + page/API inventory + role-name grep; ADR construction-domain-permissions-and-rbac; `/admin/access` entity grid, catalog v3, clone + assign | **Out of BE rollup** until field UAT; do not flip Scaffold ✅ without Pilot evidence |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs except AC-CON-TENANT, AC-CON-RBAC, AC-CON-ACT-LINES, AC-CON-W1-SCAFFOLD, AC-CON-W3-DEPTH, AC-CON-W4-PRODUCT, AC-CON-EST, AC-CON-SMETA-RATE) → **✅**.  
Those 🟡 rows stay **out of Scaffold BE rollup**.  
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-CON-SMETA-RATE | Field UAT + richer DESN content (out of MVP) | Out of BE rollup | API / SCREEN |
| AC-CON-W1-SCAFFOLD | Historical Wave 1 shell row (depth/structure moved to W3/W4) | Out of BE rollup | STUB legacy |
| AC-CON-W3-DEPTH | HTTP negative suite + UAT | Out of BE rollup | API / SCREEN |
| AC-CON-W4-PRODUCT | HTTP negative suite + UAT / Demo signoff | Out of BE rollup | API / SCREEN |
| AC-CON-ACT-LINES | HTTP negative suite + UAT (OpsUI SCREEN landed Wave 2) | Out of BE rollup | API / SCREEN |
| AC-CON-EST | Field UAT + richer Excel (xlsx) if needed | Out of BE rollup | CSV import + SOV seed landed; API / SCREEN |
| AC-CON-TENANT | Field two-org isolation UAT (SHARED default) | Out of BE rollup | Schema+filter + UAT-SMOKE §tenancy |
| AC-CON-RBAC | Field UAT / SHOW | Out of BE rollup | SCREEN until signoff |
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-construction/__tests__/con-prj-negative.spec.ts` | AC-CON-PRJ |
| `era-construction/__tests__/con-mat-negative.spec.ts` | AC-CON-MAT |
| `era-construction/__tests__/con-plat-negative.spec.ts` | AC-CON-PLAT |
| `era-construction/__tests__/progress-act-lines.spec.ts` | AC-CON-ACT-LINES |
| `era-construction/__tests__/con-w3-depth.spec.ts` | AC-CON-W3-DEPTH |
| `era-construction/__tests__/con-w4-product.spec.ts` | AC-CON-W4-PRODUCT |
| `era-construction/__tests__/con-est-negative.spec.ts` | AC-CON-EST |
| `era-construction/__tests__/con-smeta-rate-negative.spec.ts` | AC-CON-SMETA-RATE |
| `era-construction/__tests__/estimate-csv-and-sov-hint.spec.ts` | AC-CON-EST |
| `era-construction/__tests__/con-tenant-shared.spec.ts` | AC-CON-TENANT |
| `era-finance-core/apps/api/test/contracts/estimate-sov-seed.spec.ts` | AC-CON-EST / AC-FIN-CON |
| `era-construction/__tests__/construction-rbac.spec.ts` | AC-CON-RBAC |
| `era-construction/__tests__/construction-rbac-doors.spec.ts` | AC-CON-RBAC |
| `era-construction/__tests__/construction-rbac-inventory.spec.ts` | AC-CON-RBAC |
| `era-construction/__tests__/construction-rbac-role-name-grep.spec.ts` | AC-CON-RBAC |
