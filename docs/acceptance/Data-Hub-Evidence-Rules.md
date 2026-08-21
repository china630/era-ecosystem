# Data Hub — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/data-hub-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** — see `apps/api/__tests__/dh-*-negative.spec.ts` |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | UAT-SMOKE lab RT signed + linked artifact |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | `pilot_ready: true` + Pilot field; yaml is SSOT |
| COVERAGE SHIPPED | Doc + API + actor UI + UAT UI path (or HEADLESS + ADR) |

## Negative-path suites (Green Scaffold BE)

| AC | Spec | UAT deny |
|----|------|----------|
| AC-DH-REG | `era-data-hub/apps/api/__tests__/dh-reg-negative.spec.ts` | UAT-SMOKE § Deny (curl) |
| AC-DH-FX | `era-data-hub/apps/api/__tests__/dh-fx-negative.spec.ts` | UAT-SMOKE § Deny (curl) |
| AC-DH-BANK | `era-data-hub/apps/api/__tests__/dh-bank-negative.spec.ts` | UAT-SMOKE § Deny (curl) |
| AC-DH-HS | `era-data-hub/apps/api/__tests__/dh-hs-negative.spec.ts` | UAT-SMOKE § Deny (curl) |
| AC-DH-VOEN | — (External e-taxes BLOCKED) | not Scaffold ✅ — **excluded from BE rollup** (Wave 8; Hotel INT) |

## Green Scaffold BE Wave 8 (2026-08-18)

| Claim | Reality |
|-------|---------|
| Scaffold BE Product-Readiness ✅ | REG/FX/BANK/HS only; VOEN out of rollup |
| AC-DH-VOEN | Stays Scaffold 🟡 External ⏸ (e-taxes BLOCKED) — not ✅ |
| Sell / edition | Unchanged — API product; `mvp`; no GA |

## Forbidden as sole proof

- Chat assertion without artifact
- Green stage-gate alone → Scaffold ✅
- MODULES_CATALOG DONE → sell/show ✅
- Soft partner-GA prose while yaml = `mvp`
- Scaffold BE ✅ → claiming live e-taxes VÖEN GA (VOEN still 🟡)

## Artifact naming

```
reports/data-hub-stage-<wave>.log
reports/data-hub-stage-<wave>-signoff.md
reports/data-hub-pilot-lab-signoff.md
```

UAT source: `era-data-hub/doc/UAT-SMOKE.md`
