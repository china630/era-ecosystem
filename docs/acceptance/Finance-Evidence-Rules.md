# Finance — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/finance-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** |
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

## Artifact naming

```
reports/finance-stage-<wave>.log
reports/finance-stage-<wave>-signoff.md
reports/finance-pilot-lab-signoff.md
reports/finance-be-negative-signoff.md
```

UAT source: [`era-finance-core/doc/UAT-SMOKE.md`](../../era-finance-core/doc/UAT-SMOKE.md)

## Green Scaffold BE Wave 6 (2026-08-17)

| Claim | Proof |
|-------|--------|
| AC-FIN-GL / ARAP / INV / EVT / CFG / HR / TAX / FA Scaffold ✅ | `apps/api/__tests__/fin-*-negative.spec.ts` (jest) |
| Scaffold BE Product-Readiness ✅ | In-scope AC rollup; UI 🟡 / Demo ❌ / Pilot unchanged |
| Signoff | [`reports/finance-be-negative-signoff.md`](../../reports/finance-be-negative-signoff.md) |

### UAT-SMOKE deny steps (lab)

See `era-finance-core/doc/UAT-SMOKE.md` § Green Scaffold deny paths.
