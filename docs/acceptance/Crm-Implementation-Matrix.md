# CRM — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Crm-Product-Readiness-Matrix.md`](./Crm-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Green Scaffold BE wave 3 — `__tests__/crm-pipe-negative.spec.ts`, `crm-party-negative.spec.ts`.  
**Wave 8 (2026-08-18):** AC-CRM-WA excluded from Scaffold BE rollup (Hotel INT pattern); stays Scaffold 🟡 / External ⏸.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-CRM-PIPE | Pipeline + lead score + automation | ✅ | [ ] | `__tests__/crm-pipe-negative.spec.ts` | Negative: module gate 403; assign grant deny (`api:leads.assign`); stage party gate |
| AC-CRM-PARTY | Party profile / FIN-MDM / Finance CP | ✅ | [ ] | `__tests__/crm-party-negative.spec.ts` | Negative: module gate 403; VÖEN/company/phone; import deny |
| AC-CRM-WA | WhatsApp Business API stage hook | 🟡 | [ ] | Orch + CRM hook | External ⏸ — vendor WhatsApp; **excluded from Scaffold BE rollup** (Hotel INT) |
| AC-CRM-TENANT | SHARED pool: `organizationId` on ops rows + composite uniques | 🟡 | [ ] | CP-TENANT-01; kit tenant extension | **Excluded from Scaffold BE rollup.** Schema + filter landed; not Scaffold ✅ (no live SHARED pool / field two-org UAT) |
| AC-CRM-RBAC | Configurable role×permission matrix + custom roles (Variant A) | 🟡 | [ ] | `crm-rbac` + `crm-rbac-doors` + page/API inventory + role-name grep; ADR crm-domain-permissions-and-rbac; `/admin/access` clone + assign | **Out of BE rollup** until field UAT; do not flip Scaffold ✅ without Pilot evidence |

**Edition / wave rollup (BE only)** = worst(PIPE, PARTY) → **✅**.  
AC-CRM-WA remains 🟡 and is **out of Scaffold BE rollup** until vendor WhatsApp leaves External. Do **not** mark WA Scaffold ✅.  
AC-CRM-TENANT is 🟡 (schema+filter) and stays **out of Scaffold BE rollup** until a live SHARED pool + field isolation UAT.  
AC-CRM-RBAC is 🟡 (Variant A landed; field UAT open) and stays **out of Scaffold BE rollup**.  
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-CRM-WA | WhatsApp Business API live hook | External ⏸ | **Excluded from Scaffold BE rollup** (Wave 8; Hotel INT) |
| AC-CRM-TENANT | Live SHARED pool + field isolation UAT | Out of BE rollup | Schema+filter only |
| AC-CRM-RBAC | Field UAT / SHOW | Out of BE rollup | SCREEN until signoff |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-crm/__tests__/crm-pipe-negative.spec.ts` | AC-CRM-PIPE |
| `era-crm/__tests__/crm-party-negative.spec.ts` | AC-CRM-PARTY |
| `era-crm/__tests__/crm-rbac.spec.ts` | AC-CRM-RBAC |
| `era-crm/__tests__/crm-rbac-doors.spec.ts` | AC-CRM-RBAC |
| `era-crm/__tests__/crm-rbac-inventory.spec.ts` | AC-CRM-RBAC |
| `era-crm/__tests__/crm-rbac-role-name-grep.spec.ts` | AC-CRM-RBAC |
