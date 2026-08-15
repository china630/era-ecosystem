# EOD and HA notes — era-bank-core

## Single-writer EOD

- One `EodRun` row per `bankOrgId` + `businessDate`.
- EOD steps (working day): FX revaluation stub, treasury liquidity gap snapshot, inter-branch netting stub, card auth hold expiry / settlement count, **deposit interest accrual** (`steps.depositInterestAccrual`), trial balance verification.
- Status `COMPLETED` only when Σ Dr = Σ Cr.

## Deposit interest accrual (MVP)

- Day-count: **ACT_365 | ACT_360 | THIRTY_360** via `interest-daycount.util` (contract `dayCountConvention`).
- `DepositContract.rateAnnual` locked at `open()`; FLOATING products resolve index+spread from `RateIndexQuote`.
- Posting: **Dr** product `glInterestExpenseCode` (fallback `SystemGlKey.INTEREST_EXPENSE`) · **Cr** `glLiabilityCode`.
- Idempotency key: `dep-accrual-{contractId}-{yyyy-mm-dd}`; `lastAccrualDate` skips re-accrual.
- Accrual posts use `allowDuringEod: true` (external mutations remain blocked while `EodRun` is `RUNNING`).
- Close pays **principal + accruedInterestMinor**; rollover **capitalizes** accrued into principal.
- EOD also records `steps.floatingRateReset`, `steps.lcr` (risk-owned).

## Degraded mode (MVP)

| Mode | Reads | Writes |
|------|-------|--------|
| Normal | OK | OK |
| EOD RUNNING | OK | Blocked except EOD-internal posts (`allowDuringEod`) |
| EOD FAILED | OK | Ops review required |

MVP implements EOD run + snapshot; external mutations while RUNNING return **HTTP 423 Locked** (aligned with DBO). EOD-internal posts pass `allowDuringEod: true`.

## HA (future)

- Active-passive API pair with shared Postgres (out of MVP).
- Advisory lock on EOD job to prevent double-run.
- On-prem: `ERA_DATA_HUB_ONPREM=true` uses [ref-data snapshot](../packages/ref-data-snapshot/snapshot.json).

## Recovery

1. Fix underlying imbalance (posting reversal).
2. Re-run EOD for business date (idempotent upsert; deposit accrual keys prevent double interest).
3. Run `node tools/audit/replay-day.mjs <date>` — exit 0 before sign-off.
