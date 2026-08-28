# Platform — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Platform-Product-Readiness-Matrix.md`](./Platform-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Green Scaffold BE Wave 7 — `era-orchestrator/apps/api/src/**/cp-*-negative.spec.ts` (AUTH/BILL/MDM/WF/SA/INT/BIND/CFG).  
**Wave 8 (2026-08-18):** TOPO briefly excluded; **reverted same day** — owner: TOPO stays **in** BE rollup as 🟡. Playbook: [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md).

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-CP-AUTH | Auth / SSO / hybrid RBAC | ✅ | [ ] | `cp-auth-negative.spec.ts`; UAT-SMOKE-RBAC § Deny | Negative: missing/invalid Bearer 401; spoofed SSO signature 401. Launch URL (CP-LAUNCH-01) still API / no UAT SHIPPED |
| AC-CP-BILL | Billing / entitlements / subscription | ✅ | [ ] | `cp-bill-negative.spec.ts`; CP-BILLING | Negative: SUBSCRIPTION_MISSING 403; foreign invoice 403; non-owner billing 403 |
| AC-CP-MDM | MDM natural person identity | ✅ | [ ] | `cp-mdm-negative.spec.ts`; ORCH-MDM-* | Negative: missing/wrong internal service token → 401 |
| AC-CP-WF | Workforce hub (hire, absence, seats, security) | ✅ | [ ] | `cp-wf-negative.spec.ts`; CP-WF-* | Negative: hire role deny 403; PLATFORM_WORKFORCE_REQUIRED 403 |
| AC-CP-SA | Super-admin platform ops | ✅ | [ ] | `cp-sa-negative.spec.ts`; UAT-SMOKE-PLATFORM § Deny | Negative: non-super-admin → 403 |
| AC-CP-INT | Integration audit boundaries (MDM/hub/events) | ✅ | [ ] | `cp-int-negative.spec.ts` + `npm run audit:integration:strict` | Negative: catalog gateway wrong/missing token 401; CI audit gate |
| AC-CP-BIND | Satellite org UUID bind + sync endpoints | ✅ | [ ] | `cp-bind-negative.spec.ts`; ADR satellite-organization-bind | Negative: POST organization/bind bad/missing Bearer → 401 |
| AC-CP-CFG | Desired-state runtime config push (SSO secret, PSA, event URL/token) | ✅ | [ ] | `cp-cfg-negative.spec.ts`; CP-CFG-01 | Negative: runtime-config without Bearer 401; short SSO (<16) 400; Sync omits short secret |
| AC-CP-TOPO | SHARED/DEDICATED/ONPREM placement + org slice + hops | 🟡 | [ ] | ADR §4–§5; SuperAdmin `/super-admin/orgs/{id}/placement`; SHARED↔ONPREM reject; Wave 7 lab hop; Wave 11 hotel curated JSON slice | **In BE rollup.** Lab: [`reports/placement-lab-hop-signoff.md`](../../reports/placement-lab-hop-signoff.md). Not Scaffold ✅ (host apply + field UAT open). Not SaaS pool sellable. [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md) |

**Edition / wave rollup (BE only)** = worst(AUTH, BILL, MDM, WF, SA, INT, BIND, CFG, TOPO) → **🟡** (TOPO).  
AC-CP-TOPO is **in Scaffold BE rollup** (owner 2026-08-18). Do **not** mark TOPO Scaffold ✅ from API scaffold alone. TOPO ✅ (later) still ≠ SaaS pool sellable.  
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-CP-AUTH | UAT RBAC lab signoff + launch-url SHIPPED | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-BILL | Field / owner billing UAT signoff | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-MDM | UAT MDM depth / companies UI | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-WF | UAT-SMOKE workforce screens | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-SA | UAT-SMOKE-PLATFORM lab signoff | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-INT | Integration audit residual shrink (ongoing) | Code | Gate G1 + negative suite |
| AC-CP-BIND | UAT bind smoke / field isolation | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-CFG | UAT runtime-config signoff | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-TOPO | Live slice dump + host apply + field migrate UAT (pool ops = later sell) | Code | Wave 7 hop + Wave 11 hotel JSON lab; residual = host apply + field |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-orchestrator/apps/api/src/auth/cp-auth-negative.spec.ts` | AC-CP-AUTH |
| `era-orchestrator/apps/api/src/billing/cp-bill-negative.spec.ts` | AC-CP-BILL |
| `era-orchestrator/apps/api/src/mdm/cp-mdm-negative.spec.ts` | AC-CP-MDM |
| `era-orchestrator/apps/api/src/platform/workforce/cp-wf-negative.spec.ts` | AC-CP-WF |
| `era-orchestrator/apps/api/src/admin/cp-sa-negative.spec.ts` | AC-CP-SA |
| `era-orchestrator/apps/api/src/platform/catalog/cp-int-negative.spec.ts` | AC-CP-INT |
| `era-orchestrator/apps/api/src/admin/cp-bind-negative.spec.ts` | AC-CP-BIND |
| `era-orchestrator/apps/api/src/admin/cp-cfg-negative.spec.ts` | AC-CP-CFG |
| `era-orchestrator/apps/api/src/placement/placement-job.service.spec.ts` (SHARED↔ONPREM + Wave 7 advance chain) | AC-CP-TOPO (still 🟡) |
