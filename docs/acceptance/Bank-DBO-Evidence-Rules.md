# Bank DBO — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Parent scope:** [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/bank-dbo-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | UAT-SMOKE lab RT signed + linked artifact |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | `pilot_ready: true` + Pilot field; yaml is SSOT |
| COVERAGE SHIPPED | Doc + API + actor UI + UAT UI path (or HEADLESS + ADR) |
| Live ASAN claim | YC-E3 evidence — stub badge alone insufficient |

## Forbidden as sole proof

- Chat assertion without artifact
- Green stage-gate alone → Scaffold ✅
- MODULES_CATALOG DONE → sell/show ✅
- Soft partner-GA prose while yaml = `mvp`
- Implying parent CAP-* OUT modules via DBO channel screens

## Artifact naming

```
reports/bank-dbo-stage-<wave>.log
reports/bank-dbo-stage-<wave>-signoff.md
reports/bank-dbo-pilot-lab-signoff.md
```

UAT source: `era-bank-dbo/doc/UAT-SMOKE.md`
