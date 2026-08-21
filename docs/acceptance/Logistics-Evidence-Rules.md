# Logistics — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/logistics-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | UAT-SMOKE lab RT signed + linked artifact |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | `pilot_ready: true` + Pilot field; yaml is SSOT |
| COVERAGE SHIPPED | Doc + API + actor UI + UAT UI path (or HEADLESS + ADR) |

## Forbidden as sole proof

- Chat assertion without artifact
- Green stage-gate alone → Scaffold ✅
- MODULES_CATALOG DONE → sell/show ✅
- Soft partner-GA prose while yaml = `mvp`

## Artifact naming

```
reports/logistics-stage-<wave>.log
reports/logistics-stage-<wave>-signoff.md
reports/logistics-pilot-lab-signoff.md
```

UAT source: `era-logistics/doc/UAT-SMOKE.md`

## Green Scaffold BE Wave 1 (2026-08-17)

| Claim | Proof |
|-------|--------|
| AC-LOG-TRIP / POD / REF / PLAT Scaffold ✅ | `__tests__/log-*-negative.spec.ts` (jest) |
| AC-LOG-TENANT | Remains 🟡; **out of BE rollup** |
| Scaffold BE Product-Readiness ✅ | In-scope AC rollup only; UI/Demo/Pilot unchanged |

### UAT-SMOKE deny steps (lab)

See `era-logistics/doc/UAT-SMOKE.md` § Green Scaffold deny paths.
