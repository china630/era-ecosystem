# Construction — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Construction-Product-Readiness-Matrix.md`](./Construction-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Negative-path suites landed — `__tests__/con-prj-negative.spec.ts`, `con-mat-negative.spec.ts`, `con-plat-negative.spec.ts`.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-CON-PRJ | Project + BOQ stub + progress act approve event | ✅ | [ ] | `__tests__/con-prj-negative.spec.ts` | Negative: module gate 403; APPROVED reopen refused |
| AC-CON-MAT | Material requisitions + plan vs actual | ✅ | [ ] | `__tests__/con-mat-negative.spec.ts` | Negative: module gate; missing project |
| AC-CON-PLAT | Platform add-ons on progress act / requisition | ✅ | [ ] | `__tests__/con-plat-negative.spec.ts` | Negative: module gate; cron secret unauthorized |
| AC-CON-TENANT | SHARED pool: `organizationId` on ops rows + composite uniques | 🟡 | [ ] | CP-TENANT-01; kit tenant extension | **Excluded from Scaffold BE rollup.** Schema + filter landed; not Scaffold ✅ (no live SHARED pool / field two-org UAT) |
| AC-CON-RBAC | Configurable role×permission matrix + custom roles (Variant A) | 🟡 | [ ] | `construction-rbac` + `construction-rbac-doors` + page/API inventory + role-name grep; ADR construction-domain-permissions-and-rbac; `/admin/access` clone + assign | **Out of BE rollup** until field UAT; do not flip Scaffold ✅ without Pilot evidence |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs except AC-CON-TENANT) → **✅**.  
AC-CON-TENANT is 🟡 (schema+filter) and stays **out of Scaffold BE rollup** until a live SHARED pool + field isolation UAT.  
AC-CON-RBAC is 🟡 (Variant A landed; field UAT open) and stays **out of Scaffold BE rollup**.  
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-CON-TENANT | Live SHARED pool + field isolation UAT | Out of BE rollup | Schema+filter only |
| AC-CON-RBAC | Field UAT / SHOW | Out of BE rollup | SCREEN until signoff |
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-construction/__tests__/con-prj-negative.spec.ts` | AC-CON-PRJ |
| `era-construction/__tests__/con-mat-negative.spec.ts` | AC-CON-MAT |
| `era-construction/__tests__/con-plat-negative.spec.ts` | AC-CON-PLAT |
| `era-construction/__tests__/construction-rbac.spec.ts` | AC-CON-RBAC |
| `era-construction/__tests__/construction-rbac-doors.spec.ts` | AC-CON-RBAC |
| `era-construction/__tests__/construction-rbac-inventory.spec.ts` | AC-CON-RBAC |
| `era-construction/__tests__/construction-rbac-role-name-grep.spec.ts` | AC-CON-RBAC |
