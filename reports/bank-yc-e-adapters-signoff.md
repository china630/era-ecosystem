# Bank YC-E adapters — signoff (scaffold)

**Date:** 2026-08-06  
**Program:** Full CBS Phase 3 YC-E  
**Edition:** [`docs/editions/bank.yaml`](../docs/editions/bank.yaml) — `pilot_ready: false` (unchanged)

## Summary

Mode-flagged live adapters are **implemented and contract-tested** in `era-bank-core`. Partner sandbox credentials and pilot field evidence are **not** available.

| Adapter | Env flags | Code path | Status |
|---------|-----------|-----------|--------|
| Payment rails | `BANK_RAIL_MODE` | `modules/payments/stub-rail.adapter.ts` + `integration/live-mode.ts` | Ready (fail-closed live) |
| Cards gateway | `BANK_CARDS_MODE` | `modules/cards/gateway/mock-azericard.gateway.ts` | Ready (fail-closed live) |
| ASAN/SİMA | `BANK_ASAN_MODE` | `integration/asan-sima-stub.adapter.ts` | Ready (fail-closed live) |
| AKB bureau | `BANK_BUREAU_MODE` | `modules/loans/bureau.adapter.ts` | Ready (fail-closed live) |
| CBAR submit | `BANK_CBAR_MODE` | `modules/regreporting/regreporting.service.ts` export path | Ready (fail-closed live) |
| Scheme/ATM | `BANK_CARDS_MODE` | `modules/atm/scheme.adapter.ts` | Lab stub |

**Tests:** `era-bank-core/apps/api/__tests__/yc-e-mode-flags.spec.ts`

## Pilot honesty

| Gate | Status |
|------|--------|
| YC-E1…E6 live staging evidence | ⏸ partner creds |
| YC-E7 pilot field | ⏸ |
| `pilot_ready: true` | **NOT set** — forbidden until E7 field proof |
| Product ga / edition bump | Blocked |

## XO scaffolds (Phase 2)

XO-1…8 engine scaffolds landed in migration `20260806040000_full_cbs_xo_scaffolds` (timestamp adjusted — `030000` already used by FC-2…7 depth).

- Ops UI: `/cards/atm`, `/markets` (era-bank)
- DBO PFM: `/pfm` (era-bank-dbo BFF stub)
- RSK-CERT pack: `GET /api/v1/risk/certification-pack` — **methodology=lab**, not certified

## Do not claim

- Live rails/cards/ASAN/AKB/CBAR IN without staging ACK
- Certified Basel/IFRS9 / ICAAP (`CAP-RSK-CERT` stays DECLARED until YC-E4)
- Commercial pilot-ready while Pilot field ⏸
