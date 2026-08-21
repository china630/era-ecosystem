# Clinic — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/clinic-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** — see `__tests__/cli-*-negative.spec.ts` |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | UAT-SMOKE lab RT signed + linked artifact |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | `pilot_ready: true` + Pilot field; yaml is SSOT |
| COVERAGE SHIPPED | Doc + API + actor UI + UAT UI path (see era-coverage-definition) |

## Negative-path suites (Green Scaffold BE wave 5)

| AC | Spec | UAT deny |
|----|------|----------|
| AC-CLI-OPS | `era-clinic/__tests__/cli-ops-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CLI-PT | `era-clinic/__tests__/cli-pt-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CLI-MD | `era-clinic/__tests__/cli-md-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CLI-SAN | `era-clinic/__tests__/cli-san-negative.spec.ts` + `__tests__/icd10-catalog.spec.ts` | UAT-SMOKE § Deny / ICD |
| AC-CLI-LAB | `era-clinic/__tests__/cli-lab-negative.spec.ts` | UAT-SMOKE § Deny (ops; not HL7) |
| AC-CLI-PRINT | `era-clinic/__tests__/cli-print-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CLI-CAP | `era-clinic/__tests__/cli-cap-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CLI-CASH | `era-clinic/__tests__/cli-cash-negative.spec.ts` | UAT-SMOKE § Deny (settle; not live KKM) |

AC-CLI-TENANT stays out of BE rollup (schema+filter only). HL7 CLI-23 + fiscal CLI-24 = External residual.

## Forbidden as sole proof

- Chat assertion without artifact
- Green stage-gate alone → Scaffold ✅
- MODULES_CATALOG DONE → sell/show ✅
- Soft partner-GA prose while yaml = `mvp`

## Artifact naming

```
reports/clinic-stage-<wave>.log
reports/clinic-stage-<wave>-signoff.md
reports/clinic-pilot-lab-signoff.md
```

UAT source: `era-clinic/doc/UAT-SMOKE.md`
