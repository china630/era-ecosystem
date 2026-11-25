# Construction — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/construction-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** — see `__tests__/con-*-negative.spec.ts` |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | UAT-SMOKE lab RT signed + linked artifact |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | `pilot_ready: true` + Pilot field; yaml is SSOT |
| COVERAGE SHIPPED | Doc + API + actor UI + UAT UI path (or HEADLESS + ADR) |

## Negative-path suites (Green Scaffold BE)

| AC | Spec | UAT deny |
|----|------|----------|
| AC-CON-PRJ | `era-construction/__tests__/con-prj-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CON-MAT | `era-construction/__tests__/con-mat-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CON-PLAT | `era-construction/__tests__/con-plat-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CON-EST | `con-est-negative.spec.ts` + `estimate-csv-and-sov-hint.spec.ts`; Finance `estimate-sov-seed.spec.ts` | UAT-SMOKE Wave-1 path + § Estimate — unsigned / field open → AC 🟡 |
| AC-CON-SMETA-RATE | `con-smeta-rate-negative.spec.ts` | UAT-SMOKE Wave-1 path + § Rate engine — unsigned → AC 🟡; not Scaffold ✅ |
| AC-CON-ACT-LINES | `progress-act-lines.spec.ts` (incl. PayApp ref) | UAT Pilot W2–W3 + Wave-1 — unsigned → AC 🟡; out of BE rollup |
| AC-CON-TENANT | `con-tenant-shared.spec.ts` (kit extension + schema) | UAT-SMOKE § SHARED tenancy — field open → AC 🟡 |

## Forbidden as sole proof

- Chat assertion without artifact
- Green stage-gate alone → Scaffold ✅
- MODULES_CATALOG DONE → sell/show ✅
- Soft partner-GA prose while yaml = `mvp`

## Artifact naming

```
reports/construction-stage-<wave>.log
reports/construction-stage-<wave>-signoff.md
reports/construction-pilot-lab-signoff.md
```

UAT source: `era-construction/doc/UAT-SMOKE.md`
