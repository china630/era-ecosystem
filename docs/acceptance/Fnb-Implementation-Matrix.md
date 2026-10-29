# F&B — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Fnb-Product-Readiness-Matrix.md`](./Fnb-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Negative-path suites landed — `__tests__/fnb-pos-negative.spec.ts`, `fnb-inv-negative.spec.ts`, `fnb-labor-negative.spec.ts`.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-FNB-POS | POS floor + courses / KDS | ✅ | [ ] | `__tests__/fnb-pos-negative.spec.ts` | Negative: module gate 403; CLOSED ticket; hotel-folio pay block |
| AC-FNB-INV | Recipe depletion / stock events | ✅ | [ ] | `__tests__/fnb-inv-negative.spec.ts` | Negative: stock off unless enabled; VOID lines excluded |
| AC-FNB-LABOR | Labor roster / PIN clock | ✅ | [ ] | `__tests__/fnb-labor-negative.spec.ts` | Negative: module gate; invalid PIN hash |
| AC-FNB-RBAC | Configurable role×permission matrix + custom roles (Variant A) | 🟡 | [ ] | `fnb-rbac` + page inventory + role-name grep + staff-provision unknown; ADR fnb-domain-permissions-and-rbac; `/admin/access` clone | **Out of BE rollup** until field UAT; do not flip Scaffold ✅ without Pilot evidence |
| AC-FNB-AUD | Mutation audit Layer A (HTTP belt) + Layer B enrich | 🟡 | [ ] | ADR era-mutation-audit-standard; FNB-AUD-01; kit belt + `/admin/audit`; CI fail-closed; Wave B PAY/DISCOUNT/ROOM_CHARGE/DEFER_HUB + PosShift; Wave E compound `(organizationId, createdAt)` | **Out of Scaffold BE rollup.** Belt + SCREEN + Layer B money/shift + Wave E index landed; UAT open — max 🟡; hash-chain deferred. Does not darken BE ✅. |

**Topology note (out of BE rollup):** F&B tenant roots carry `organizationId` + kit filter (CP-TENANT-01 API). Wave 3: login/SSO JWT org + `enterSatelliteTenant` + ops `requestOrganizationId()`. SHARED F&B pool still not an AC this edition — see Fnb-Acceptance-System.

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs except AC-FNB-RBAC) → **✅**.  
Do not call this table «product readiness».

AC-FNB-RBAC is 🟡 (Variant A shipped; field UAT open) and stays **out of Scaffold BE rollup**.
AC-FNB-AUD is 🟡 (belt + `/admin/audit` SCREEN + Wave B money/shift Layer B + Wave E compound index; UAT open; hash-chain deferred) and stays **out of Scaffold BE rollup**.

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |
| (no TENANT AC) | SHARED F&B pool | Out of BE rollup | Wave 3 request tenant code; topology note only — not an AC this edition |
| AC-FNB-RBAC | Field UAT / SHOW | Out of BE rollup | SCREEN until signoff |
| (no AC) | Edition / hall preset / hotel mode split + owner upgrade (FNB-09 / FNB-10) | Out of BE rollup | API: unit tests `fnb-rbac.spec.ts` (edition resolve, preset clamp, metered kitchen; `hotelMode=false` on `fnb` stays `fnb`), orch `fnb-edition.service.spec.ts` + `kafe-foundation.spec.ts`; UAT step open |
| (no AC) | Outlet capabilities + Elektra gate (FNB-09 deepen) | Out of BE rollup | Caps/shape on Outlet; `/select-outlet`; kill invent `RESTAURANT`; Settings DELETE; nav `when` caps; negative: `OUTLET_RETIRED` / `OUTLET_NO_TILL` (shift/ticket/terminal). **No Scaffold ✅** — UAT FB-OUTLET-01 open. ADR fnb-outlet-capabilities-and-gate |
| (no AC) | Buffet Planner module (FNB-BUFFET-01) | Out of BE rollup | API/SCREEN only — **no Scaffold ✅** (no PRD AC row; UAT FB-5 open; FIN-INV-SCOPE-01 open). Proof: route map + waste math + list aggregates + submodule deny in `__tests__/fnb-buffet-planner.spec.ts`; chef UX submenu + spawn factor `__tests__/fnb-buffet-production-factor.spec.ts`; ADR fnb-buffet-planner |
| (no AC) | Buffet cost attribution (FNB-BUFFET-COST-01) | Out of BE rollup | Waves 1–6 + Phase A–D + chef-ready WO + polish + chef UX wave (hotel pax sync, management eaters) — **no Scaffold ✅** (no PRD AC; UAT open — not Pilot). Proof: hybrid-handoff + finance-unit-cogs + forecast-pack + Finance math specs + lab seeds · UAT/punchlist unsigned · SSOT [fnb-buffet-chef-ready-backlog.md](../adr/fnb-buffet-chef-ready-backlog.md) (C3 won't-do / non-goal; C8 = future RBAC). Do not sell |
| AC-FNB-AUD | UAT for `/admin/audit` | Out of BE rollup | Wave B PAY/PosShift Layer B + Wave E compound index landed 2026-10-29; hash-chain deferred; FNB-AUD-01 API until UAT |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-fnb-pos/__tests__/fnb-pos-negative.spec.ts` | AC-FNB-POS |
| `era-fnb-pos/__tests__/fnb-inv-negative.spec.ts` | AC-FNB-INV |
| `era-fnb-pos/__tests__/fnb-labor-negative.spec.ts` | AC-FNB-LABOR |
| `era-fnb-pos/__tests__/fnb-rbac.spec.ts` | AC-FNB-RBAC |
| `era-fnb-pos/__tests__/fnb-page-route-inventory.spec.ts` | AC-FNB-RBAC |
| `era-fnb-pos/__tests__/fnb-rbac-role-name-grep.spec.ts` | AC-FNB-RBAC |
| `era-fnb-pos/__tests__/staff-provision.spec.ts` | AC-FNB-RBAC (unknown role) |
| `era-fnb-pos/__tests__/fnb-buffet-planner.spec.ts` | FNB-BUFFET-01 (capability; out of AC rollup) |
| `era-fnb-pos/__tests__/fnb-buffet-production-factor.spec.ts` | FNB-BUFFET-01 spawn factor math (out of AC rollup) |
| `era-fnb-pos/__tests__/fnb-buffet-hybrid-handoff.spec.ts` | FNB-BUFFET-COST-01 Phase A handoff + chef-ready staff/COGS (out of AC rollup) |
| `era-fnb-pos/__tests__/fnb-buffet-finance-unit-cogs.spec.ts` | FNB-BUFFET-COST-01 chef-ready A1 Finance unit COGS map (out of AC rollup) |
| `era-fnb-pos/__tests__/fnb-buffet-forecast-pack.spec.ts` | FNB-BUFFET-COST-01 Wave 6 + Phase B band/SKU guards (out of AC rollup) |
| `era-fnb-pos/__tests__/fnb-buffet-comp-attribution.spec.ts` | FNB-BUFFET-COST-01 Wave 4 (out of AC rollup) |
| `era-fnb-pos/__tests__/fnb-buffet-cost-settings.spec.ts` | FNB-BUFFET-COST-01 Wave 1 (out of AC rollup) |
| `era-finance-core/apps/api/__tests__/buffet-food-cost-run.math.spec.ts` | FNB-BUFFET-COST-01 Wave 5 (out of AC rollup) |
| `era-finance-core/apps/api/__tests__/outlet-budget-run.math.spec.ts` | FNB-BUFFET-COST-01 Wave 6 (out of AC rollup) |
