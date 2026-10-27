# Hotel — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/hotel-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | UAT-SMOKE lab RT signed + linked artifact |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | `pilot_ready: true` + Pilot field; yaml is SSOT |
| COVERAGE SHIPPED | Doc + API + actor UI + UAT UI path (see era-coverage-definition) |
| AC-HOT-AUD Scaffold ✅ | Layer A belt on hotel mutations + deny-list/`audit-exempt` + negative: exempt path skips row, money path still succeeds if audit insert fails; UAT shows `/admin/audit` `HTTP_MUTATION` **and** a Layer B money/lifecycle sample; reports-without-admin can open the page. ADR era-mutation-audit-standard. Until then max 🟡 |

## Forbidden as sole proof

- Chat assertion without artifact
- Green stage-gate alone → Scaffold ✅
- MODULES_CATALOG DONE → sell/show ✅
- Soft partner-GA prose while yaml = `mvp`

## Artifact naming

```
reports/hotel-stage-<wave>.log
reports/hotel-stage-<wave>-signoff.md
reports/hotel-pilot-lab-signoff.md
```

UAT source: `era-hotel-pms/doc/UAT-SMOKE.md`
