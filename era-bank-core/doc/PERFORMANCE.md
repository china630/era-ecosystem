# Performance baseline — era-bank-core

Dev hardware target from Sprint 5 gate: **500 postings in 60 seconds**, zero balance drift after burst.

## Run benchmark

```bash
cd era-bank-core
ERA_BANK_CORE_URL=http://127.0.0.1:4300 \
BANK_CORE_SERVICE_TOKEN=dev-bank-core-service-token \
node tools/load/posting-benchmark.mjs
```

Env overrides: `BENCH_TOTAL` (default 500), `BENCH_CONCURRENCY` (default 25).

## Verify balance integrity

After benchmark:

```bash
DATABASE_URL=postgresql://.../era_bank_core \
ERA_BANK_ORGANIZATION_ID=demo-bank-org-001 \
node tools/audit/replay-day.mjs 2026-06-14
```

Exit code 0 requires Σ Dr = Σ Cr for the business date.

## Baseline (dev reference)

| Metric | Target | Notes |
|--------|--------|-------|
| Throughput | ≥ 500 txns / 60s | Internal transfer fixture |
| Error rate | < 5% | Seed accounts required |
| Balance drift | 0 | replay-day exit 0 |
| p95 latency | document only | Reported by benchmark JSON |

Production sizing and HA are out of MVP scope — see [EOD-HA.md](./EOD-HA.md).
