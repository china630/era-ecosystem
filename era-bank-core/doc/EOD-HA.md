# EOD and HA notes — era-bank-core

## Single-writer EOD

- One `EodRun` row per `bankOrgId` + `businessDate`.
- EOD steps: FX revaluation stub, inter-branch netting, trial balance verification.
- Status `COMPLETED` only when Σ Dr = Σ Cr.

## Degraded mode (MVP)

| Mode | Reads | Writes |
|------|-------|--------|
| Normal | OK | OK |
| EOD RUNNING | OK | 423 Locked (planned enforcement) |
| EOD FAILED | OK | Ops review required |

MVP implements EOD run + snapshot; write lock during RUNNING is documented for certification hardening.

## HA (future)

- Active-passive API pair with shared Postgres (out of MVP).
- Advisory lock on EOD job to prevent double-run.
- On-prem: `ERA_DATA_HUB_ONPREM=true` uses [ref-data snapshot](../packages/ref-data-snapshot/snapshot.json).

## Recovery

1. Fix underlying imbalance (posting reversal).
2. Re-run EOD for business date (idempotent upsert).
3. Run `node tools/audit/replay-day.mjs <date>` — exit 0 before sign-off.
