# Two-org isolation signoff (SaaS Waves 5 + 9)

**Scope:** CP-TENANT-01 / hotel + clinic kit Prisma tenant filter + request ALS  
**Does not claim:** SHIPPED, AC-*-TENANT Scaffold ✅, sellable SHARED SaaS pool, edition `ga`

## Lab checklist (CI) — Wave 5

| Step | Result | Notes |
|------|--------|-------|
| Clinic `__tests__/saas-wave5-two-org-isolation.spec.ts` | pass | `npm test -- --testPathPattern=saas-wave5-two-org-isolation` in `era-clinic` |
| Hotel `__tests__/saas-wave5-two-org-isolation.spec.ts` | pass | same pattern in `era-hotel-pms` |
| ALS stamp wins over process bind | pass | covered in both suites |

### Lab signoff

- Runner: CI / Wave 5 agent
- Date: 2026-08-28
- Verdict: **lab passed** (suites green). Does **not** promote AC-*-TENANT to Scaffold ✅.

## Live pool smoke (opt-in) — Wave 9

One DB + Prisma tenant extension: Org B must not see Org A rows.

```bash
# hotel
cd era-hotel-pms
# ensure DATABASE_URL points at a migrated hotel DB
set ERA_WAVE9_POOL_SMOKE=1   # PowerShell: $env:ERA_WAVE9_POOL_SMOKE="1"
node scripts/saas-wave9-two-org-pool-smoke.mjs

# clinic
cd era-clinic
set ERA_WAVE9_POOL_SMOKE=1
node scripts/saas-wave9-two-org-pool-smoke.mjs
```

Without `ERA_WAVE9_POOL_SMOKE=1` scripts **SKIP** (exit 0) — safe for default CI.

| Step | Result (pass / fail / skip) | Notes |
|------|-----------------------------|-------|
| Hotel live pool smoke | skip until local run | `era-hotel-pms/scripts/saas-wave9-two-org-pool-smoke.mjs` |
| Clinic live pool smoke | skip until local run | `era-clinic/scripts/saas-wave9-two-org-pool-smoke.mjs` |

### Live smoke signoff

- Runner:
- Date:
- Verdict: **not required for Scaffold ✅**; fills middle tier before field. Still not sellable pool.

## Field checklist (pending)

| Step | Result (pass / fail / skip) | Notes |
|------|-----------------------------|-------|
| API: ORG_A rows invisible under ORG_B session (clinic) | pending | [era-clinic/doc/UAT-SMOKE.md](../era-clinic/doc/UAT-SMOKE.md) § Topology |
| UI: clinic `/patients` isolation | pending | |
| API: ORG_A guests/reservations invisible under ORG_B (hotel) | pending | [era-hotel-pms/doc/UAT-SMOKE.md](../era-hotel-pms/doc/UAT-SMOKE.md) § Topology |
| UI: hotel FO guests isolation | pending | |
| Negative: cross-org id update blocked | pending | |

### Field signoff

- Runner:
- Date:
- Verdict: **not passed** until all critical field rows are pass — required before AC-*-TENANT Scaffold ✅
