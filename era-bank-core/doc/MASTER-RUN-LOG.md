# Bank CBS — Master Run Log

Track gate results for the CBS Master Run orchestration plan.

| Sprint | Gate | Status | Date | Notes |
|--------|------|--------|------|-------|
| Pre-flight | PF | **passed** | 2026-06-14 | contracts + satellite-kit built; bank DBs created; migrate+seed |
| Sprint 1 | Gate 1 | **passed** | 2026-06-14 | build OK; 10/10 unit tests; `:4300` + `:3210` health green |
| Sprint 2 | Gate 2 | **passed** | 2026-06-14 | AML/reg modules; finance `SATELLITE_BANK_GL_DAILY_SUMMARY` dispatch |
| Sprint 3 | Gate 3 | **passed** | 2026-06-14 | `:3211` era-bank-dbo health; DBO seed + API surface |
| Sprint 4 | Gate 4 | **passed** | 2026-06-14 | card auth/capture API + `tools/card-acquiring-stub.mjs` |
| Sprint 5 | Gate 5 | **passed** | 2026-06-14 | treasury module; replay-day exit 0; docs + READINESS MVP |

## Verification commands (local)

```bash
cd era-bank-core && npm test -- --ci && npm run build
curl.exe -sf http://127.0.0.1:4300/api/health
curl.exe -sf http://127.0.0.1:3210/api/health
curl.exe -sf http://127.0.0.1:3211/api/health
node era-bank-core/tools/audit/replay-day.mjs 2026-06-14
```

## Docker post-deploy

```bash
docker build -f docker/Dockerfile.packages -t era-ecosystem/packages:local .
docker compose build bank-core bank bank-dbo
docker compose up -d bank-core bank bank-dbo
bash docker/scripts/migrate-all.sh
```

## Fixes during Master Run

- `BankCommonModule` (@Global) — `BankOrgConfig` DI for kernel modules
- `AuthModule` (@Global) — `BankAuthGuard` available on all controllers
- Card capture endpoint + acquiring stub for Gate 4
