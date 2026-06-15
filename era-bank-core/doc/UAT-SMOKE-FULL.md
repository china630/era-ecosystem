# UAT smoke — full CBS stack (P0–P7)

Single checklist for Master Run Gate 5. Allow ~45 minutes with Docker stack up.

## Stack boot

```bash
docker compose up -d postgres redis
docker build -f docker/Dockerfile.packages -t era-ecosystem/packages:local .
docker compose up -d bank-core bank bank-dbo orchestrator finance-core
bash docker/scripts/migrate-all.sh
```

Health:

```bash
curl -sf http://127.0.0.1:4300/api/health
curl -sf http://127.0.0.1:3210/api/health
curl -sf http://127.0.0.1:3211/api/health
```

## Phase checklist

| Phase | Smoke | Doc |
|-------|-------|-----|
| P0–P1 | CIF → account → posting → EOD balanced | [UAT-SMOKE.md](./UAT-SMOKE.md) |
| P2 | Payment order submit | engine + [era-bank/doc/UAT-SMOKE.md](../../era-bank/doc/UAT-SMOKE.md) |
| P3 | Deposit + loan contracts | engine |
| P4 | AML alert + CBAR export + GL summary in finance | engine + finance journal |
| P5 | DBO OTP login → transfer | [era-bank-dbo/doc/UAT-SMOKE.md](../../era-bank-dbo/doc/UAT-SMOKE.md) |
| P6 | Card auth/capture stub | `node tools/card-acquiring-stub.mjs` |
| P7 | FX deal + GAP dashboard | engine + era-bank `/treasury` |

## Automated subset

```bash
cd era-bank-core && npm test -- --ci
node era-bank-core/tools/audit/replay-day.mjs $(date +%F)
```

## Sign-off

- [ ] All three apps healthy
- [ ] Σ Dr = Σ Cr after EOD
- [ ] No ledger tables in `era_bank` / `era_bank_dbo` (ops/channel only)
- [ ] [READINESS_MATRIX.md](../../docs/READINESS_MATRIX.md) banking modules MVP
