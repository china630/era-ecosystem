# Platform — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/platform-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** — see `era-orchestrator/apps/api/src/**/cp-*-negative.spec.ts` |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | UAT-SMOKE lab RT signed + linked artifact |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | `pilot_ready: true` + Pilot field; yaml is SSOT |
| COVERAGE SHIPPED | Doc + API + actor UI + UAT UI path (see era-coverage-definition) |

## Forbidden as sole proof

- Chat assertion without artifact
- Green stage-gate alone → Scaffold ✅
- MODULES_CATALOG DONE → sell/show ✅
- Soft partner-GA prose while yaml = `mvp`
- Scaffold BE ✅ on AUTH…CFG → claiming SaaS pool / live migrate while AC-CP-TOPO stays 🟡 **in** rollup

## Artifact naming

```
reports/platform-stage-<wave>.log
reports/platform-stage-<wave>-signoff.md
reports/platform-pilot-lab-signoff.md
```

UAT source: `era-orchestrator/doc/UAT-SMOKE-PLATFORM.md`, `UAT-SMOKE-RBAC.md`

## Negative-path suites (Green Scaffold BE Wave 7)

| AC | Jest suite | UAT deny |
|----|------------|----------|
| AC-CP-AUTH | `apps/api/src/auth/cp-auth-negative.spec.ts` | UAT-SMOKE-RBAC § Deny |
| AC-CP-BILL | `apps/api/src/billing/cp-bill-negative.spec.ts` | UAT-SMOKE-PLATFORM § Deny |
| AC-CP-MDM | `apps/api/src/mdm/cp-mdm-negative.spec.ts` | UAT-SMOKE-PLATFORM § Deny |
| AC-CP-WF | `apps/api/src/platform/workforce/cp-wf-negative.spec.ts` | UAT-SMOKE-PLATFORM § Deny |
| AC-CP-SA | `apps/api/src/admin/cp-sa-negative.spec.ts` | UAT-SMOKE-PLATFORM § Deny |
| AC-CP-INT | `apps/api/src/platform/catalog/cp-int-negative.spec.ts` + `npm run audit:integration:strict` | UAT-SMOKE-PLATFORM § Deny |
| AC-CP-BIND | `apps/api/src/admin/cp-bind-negative.spec.ts` | UAT-SMOKE-PLATFORM § Deny |
| AC-CP-CFG | `apps/api/src/admin/cp-cfg-negative.spec.ts` | UAT-SMOKE-PLATFORM § Deny |
| AC-CP-TOPO | `placement-job.service.spec.ts` SHARED↔ONPREM only | Scaffold 🟡 **in BE rollup** — [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md) |

## AC-CP-TOPO (in BE rollup)

| Claim | Reality |
|-------|---------|
| Scaffold BE Product-Readiness | **🟡** — TOPO in rollup (PlacementJob API ≠ live hop) |
| How to close | [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md) §2 |
| Topology honesty | SHARED pool **Not built**; migrate **not sellable** |
| Sell / edition | `mvp` / `pilot_ready: false`; no GA / no SaaS pool |
