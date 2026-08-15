# Bank — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Scope boundary:** [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/bank-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | UAT-SMOKE lab RT signed + linked artifact |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | `pilot_ready: true` + Pilot field; yaml is SSOT |
| COVERAGE SHIPPED | Doc + API + actor UI + UAT UI path (see era-coverage-definition) |
| CAP-* IN (new) | PRD/TZ + module/AC + Inventory row + COVERAGE |
| CAP-* live (DECLARED→SHIPPED) | YC-E evidence / partner ACK — never stub default |
| CAP-* OUT → in edition | Explicit PRD change + Inventory status change in same PR |

## Forbidden as sole proof

- Chat assertion without artifact
- Green stage-gate alone → Scaffold ✅
- MODULES_CATALOG DONE → sell/show ✅
- Soft partner-GA prose while yaml = `mvp`
- In-scope AC all ✅ → «полная АБС» / coverage of CAP-* OUT
- Stub rails/cards/ASAN/AKB → COVERAGE SHIPPED or certified claim

## Artifact naming

```
reports/bank-stage-<wave>.log
reports/bank-stage-<wave>-signoff.md
reports/bank-pilot-lab-signoff.md
```

UAT source: `era-bank/doc/UAT-SMOKE.md`, `era-bank-core/doc/UAT-SMOKE.md`
