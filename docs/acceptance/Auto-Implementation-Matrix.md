# Auto Service — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Auto-Product-Readiness-Matrix.md`](./Auto-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Negative-path suites landed — `__tests__/auto-wo-negative.spec.ts`, `auto-appt-negative.spec.ts`, `auto-plat-negative.spec.ts`.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-AUTO-WO | Work order CRUD + close event | ✅ | [ ] | `__tests__/auto-wo-negative.spec.ts` | Negative: module gate 403; COMPLETED refuses labor/parts |
| AC-AUTO-APPT | Appointments + bay calendar contours | ✅ | [ ] | `__tests__/auto-appt-negative.spec.ts` | Negative: module gate; empty vehiclePlate |
| AC-AUTO-PLAT | Platform notifications/booking cron + commerce on complete | ✅ | [ ] | `__tests__/auto-plat-negative.spec.ts` | Negative: module gate; cron secret unauthorized |
| AC-AUTO-TENANT | SHARED pool: `organizationId` on ops rows + composite uniques | 🟡 | [ ] | CP-TENANT-01; kit tenant extension | **Excluded from Scaffold BE rollup.** Schema + filter landed; not Scaffold ✅ (no live SHARED pool / field two-org UAT) |
| AC-AUT-RBAC | Configurable role×permission matrix + custom roles (Variant A) | 🟡 | [ ] | `auto-rbac` + `auto-rbac-doors` + page/API inventory + role-name grep; ADR auto-domain-permissions-and-rbac; `/admin/access` clone + assign | **Out of BE rollup** until field UAT; do not flip Scaffold ✅ without Pilot evidence |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs except AC-AUTO-TENANT) → **✅**.  
AC-AUTO-TENANT is 🟡 (schema+filter) and stays **out of Scaffold BE rollup** until a live SHARED pool + field isolation UAT.  
AC-AUT-RBAC is 🟡 (Variant A landed; field UAT open) and stays **out of Scaffold BE rollup**.  
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-AUTO-TENANT | Live SHARED pool + field isolation UAT | Out of BE rollup | Schema+filter only |
| AC-AUT-RBAC | Field UAT / SHOW | Out of BE rollup | SCREEN until signoff |
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-auto-service/__tests__/auto-wo-negative.spec.ts` | AC-AUTO-WO |
| `era-auto-service/__tests__/auto-appt-negative.spec.ts` | AC-AUTO-APPT |
| `era-auto-service/__tests__/auto-plat-negative.spec.ts` | AC-AUTO-PLAT |
| `era-auto-service/__tests__/auto-rbac.spec.ts` | AC-AUT-RBAC |
| `era-auto-service/__tests__/auto-rbac-doors.spec.ts` | AC-AUT-RBAC |
| `era-auto-service/__tests__/auto-rbac-inventory.spec.ts` | AC-AUT-RBAC |
| `era-auto-service/__tests__/auto-rbac-role-name-grep.spec.ts` | AC-AUT-RBAC |
