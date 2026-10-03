# Retail — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Retail-Product-Readiness-Matrix.md`](./Retail-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Green Scaffold BE wave 2 — `__tests__/ret-pos-negative.spec.ts`, `ret-stock-negative.spec.ts`.  
**Wave 8 (2026-08-18):** AC-RET-FISCAL excluded from Scaffold BE rollup (Hotel INT pattern); stays Scaffold 🟡 / External ⏸.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-RET-POS | POS + promos + customer | ✅ | [ ] | `__tests__/ret-pos-negative.spec.ts` | Negative: module gate 403; PAID void / promo / line-void; apparel variant |
| AC-RET-STOCK | Mobile stock / replenishment / SRM | ✅ | [ ] | `__tests__/ret-stock-negative.spec.ts` | Negative: module gate 403; empty write-off lines |
| AC-RET-FISCAL | Offline queue / fiscal KKM / marketplace | 🟡 | [ ] | M8–M10 stubs where applicable | Explicit stub — **excluded from Scaffold BE rollup** (External ⏸; Hotel INT) |
| AC-RET-TENANT | SHARED pool: `organizationId` on ops rows + composite uniques | 🟡 | [ ] | CP-TENANT-01; kit tenant extension; Wave 3 login/JWT/`enterSatelliteTenant` | **Excluded from Scaffold BE rollup.** Schema + request tenant code landed; still not Scaffold ✅ (no live SHARED pool / field two-org UAT) |
| AC-RET-RBAC | Configurable role×permission matrix + custom roles (Variant A) | 🟡 | [ ] | `retail-rbac` + `retail-rbac-doors` + page/API inventory + role-name grep; ADR retail-domain-permissions-and-rbac; `/admin/access` clone + assign | **Out of BE rollup** until field UAT; do not flip Scaffold ✅ without Pilot evidence |

**Edition / wave rollup (BE only)** = worst(POS, STOCK) → **✅**.  
AC-RET-FISCAL remains 🟡 and is **out of Scaffold BE rollup** until vendor/fiscal modes leave STUB. Do **not** mark FISCAL Scaffold ✅.  
AC-RET-TENANT is 🟡 (Nafta retail placement is SHARED; schema+filter) and stays **out of Scaffold BE rollup** until field isolation UAT.  
AC-RET-RBAC is 🟡 (Variant A landed; field UAT open) and stays **out of Scaffold BE rollup**.  
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-RET-FISCAL | Offline queue / live KKM / marketplace | External ⏸ | **Excluded from Scaffold BE rollup** (Wave 8; Hotel INT) |
| AC-RET-TENANT | Live SHARED pool + field isolation UAT | Out of BE rollup | Wave 3 request tenant code; Scaffold ✅ still needs field pass |
| AC-RET-RBAC | Field UAT / SHOW | Out of BE rollup | SCREEN until signoff |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-retail-pos/__tests__/ret-pos-negative.spec.ts` | AC-RET-POS |
| `era-retail-pos/__tests__/ret-stock-negative.spec.ts` | AC-RET-STOCK |
| `era-retail-pos/__tests__/retail-rbac.spec.ts` | AC-RET-RBAC |
| `era-retail-pos/__tests__/retail-rbac-doors.spec.ts` | AC-RET-RBAC |
| `era-retail-pos/__tests__/retail-rbac-inventory.spec.ts` | AC-RET-RBAC |
| `era-retail-pos/__tests__/retail-rbac-role-name-grep.spec.ts` | AC-RET-RBAC |
