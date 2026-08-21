# Retail — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/retail-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** — see `__tests__/ret-*-negative.spec.ts` |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | UAT-SMOKE lab RT signed + linked artifact |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | `pilot_ready: true` + Pilot field; yaml is SSOT |
| COVERAGE SHIPPED | Doc + API + actor UI + UAT UI path (see era-coverage-definition) |

## Negative-path suites (Green Scaffold BE)

| AC | Spec | UAT deny |
|----|------|----------|
| AC-RET-POS | `era-retail-pos/__tests__/ret-pos-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-RET-STOCK | `era-retail-pos/__tests__/ret-stock-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-RET-FISCAL | — (External stub) | not Scaffold ✅ — **excluded from BE rollup** (Wave 8; Hotel INT) |

## Green Scaffold BE Wave 8 (2026-08-18)

| Claim | Reality |
|-------|---------|
| Scaffold BE Product-Readiness ✅ | POS+STOCK only; FISCAL out of rollup |
| AC-RET-FISCAL | Stays Scaffold 🟡 External ⏸ — not ✅ |
| Sell / edition | Unchanged — fiscal field open; `mvp`; no GA |

## Forbidden as sole proof

- Chat assertion without artifact
- Green stage-gate alone → Scaffold ✅
- MODULES_CATALOG DONE → sell/show ✅
- Soft partner-GA prose while yaml = `mvp`
- Scaffold BE ✅ → claiming live KKM / marketplace GA (FISCAL still 🟡)

## Artifact naming

```
reports/retail-stage-<wave>.log
reports/retail-stage-<wave>-signoff.md
reports/retail-pilot-lab-signoff.md
```

UAT source: `era-retail-pos/doc/UAT-SMOKE.md`
