# F&B — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/fnb-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** — see `__tests__/fnb-*-negative.spec.ts` |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | UAT-SMOKE lab RT signed + linked artifact |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | `pilot_ready: true` + Pilot field; yaml is SSOT |
| COVERAGE SHIPPED | Doc + API + actor UI + UAT UI path (see era-coverage-definition) |

## Negative-path suites (Green Scaffold BE)

| AC | Spec | UAT deny |
|----|------|----------|
| AC-FNB-POS | `era-fnb-pos/__tests__/fnb-pos-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-FNB-INV | `era-fnb-pos/__tests__/fnb-inv-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-FNB-LABOR | `era-fnb-pos/__tests__/fnb-labor-negative.spec.ts` | UAT-SMOKE § Deny |

## Forbidden as sole proof

- Chat assertion without artifact
- Green stage-gate alone → Scaffold ✅
- MODULES_CATALOG DONE → sell/show ✅
- Soft partner-GA prose while yaml = `mvp`

## Artifact naming

```
reports/fnb-stage-<wave>.log
reports/fnb-stage-<wave>-signoff.md
reports/fnb-pilot-lab-signoff.md
```

UAT source: `era-fnb-pos/doc/UAT-SMOKE.md`
