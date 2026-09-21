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

**Topology note (out of BE rollup):** F&B tenant roots carry `organizationId` + kit filter (CP-TENANT-01 API). Wave 3: login/SSO JWT org + `enterSatelliteTenant` + ops `requestOrganizationId()`. SHARED F&B pool still not an AC this edition — see Fnb-Acceptance-System.

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs except AC-FNB-RBAC) → **✅**.  
Do not call this table «product readiness».

AC-FNB-RBAC is 🟡 (Variant A shipped; field UAT open) and stays **out of Scaffold BE rollup**.

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |
| (no TENANT AC) | SHARED F&B pool | Out of BE rollup | Wave 3 request tenant code; topology note only — not an AC this edition |
| AC-FNB-RBAC | Field UAT / SHOW | Out of BE rollup | SCREEN until signoff |

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
