# CRM — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/crm-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** — see `__tests__/crm-*-negative.spec.ts` |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | UAT-SMOKE lab RT signed + linked artifact |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | `pilot_ready: true` + Pilot field; yaml is SSOT |
| COVERAGE SHIPPED | Doc + API + actor UI + UAT UI path (see era-coverage-definition) |

## Negative-path suites (Green Scaffold BE)

| AC | Spec | UAT deny |
|----|------|----------|
| AC-CRM-PIPE | `era-crm/__tests__/crm-pipe-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CRM-PARTY | `era-crm/__tests__/crm-party-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CRM-WA | — (External vendor) | not Scaffold ✅ — **excluded from BE rollup** (Wave 8; Hotel INT) |

## Green Scaffold BE Wave 8 (2026-08-18)

| Claim | Reality |
|-------|---------|
| Scaffold BE Product-Readiness ✅ | PIPE+PARTY only; WA out of rollup |
| AC-CRM-WA | Stays Scaffold 🟡 External ⏸ — not ✅ |
| Sell / edition | Unchanged — pilot open; `mvp`; no GA |

## Forbidden as sole proof

- Chat assertion without artifact
- Green stage-gate alone → Scaffold ✅
- MODULES_CATALOG DONE → sell/show ✅
- Soft partner-GA prose while yaml = `mvp`
- Scaffold BE ✅ → claiming live WhatsApp GA (WA still 🟡)

## Artifact naming

```
reports/crm-stage-<wave>.log
reports/crm-stage-<wave>-signoff.md
reports/crm-pilot-lab-signoff.md
```

UAT source: `era-crm/doc/UAT-SMOKE.md`
