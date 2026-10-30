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
| AC-FNB-AUD Scaffold ✅ | Layer A belt + deny-list/`audit-exempt` negatives + CI fail-closed scan + UAT on `/admin/audit` with canonical filters (`entityType`/`entityId`/`action`/`dateFrom`/`dateTo`/`userId`) via `GET /api/admin/audit` **and** a Layer B sample (PAY or PosShift CLOSE). ADR era-mutation-audit-standard. Wave B writers / Wave E compound index alone ≠ Scaffold ✅. Until then max 🟡 |
| FNB-BUFFET-01 SHOW | Signed UAT FB-5 (AZ chef path WP0–WP8: chrome, templates list+modal, week CTA, accordion) — WP code alone ≠ SHOW |
| FNB-BUFFET-COST-01 SHIPPED / SHOW | Signed UAT-SMOKE Waves 1–6 + Phase A–D chef/Finance paths + WP0–WP8 AZ walkthrough + no open Critical residual. Lab seed + unsigned [`reports/fnb-buffet-cost-lab-signoff.md`](../../reports/fnb-buffet-cost-lab-signoff.md) / punchlist = SCREEN only — **not** Demo ✅ until human signs; **not** Scaffold ✅ / sellable / `ga` until Pilot rules |

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
