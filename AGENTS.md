# AGENTS.md

## Cursor Cloud specific instructions

This repo is the **ERA Ecosystem** umbrella (a flat monorepo of independent npm apps).
Canonical setup/run reference: `docs/SETUP_AND_RUN.md` and `docs/LOCAL_FOLDER_DEV.md`.
Ports/URLs: `docs/ECOSYSTEM_URLS.md`. Credentials after bootstrap: `tmp/era-local-credentials.md` (gitignored).

### Scope set up in this environment

Dev readiness is configured for the **core platform** only (the services flagged required for
an end-to-end flow):

| Service | Path | Dev command | Ports |
|---------|------|-------------|-------|
| Orchestrator (control plane / IdP) | `era-orchestrator` | `npm run dev` | API 4000, Web 3000 |
| Finance Core (data plane) | `era-finance-core` | API + Web run separately (see below) | API 4100, Web 3100 |

The optional verticals (`era-data-hub`, the bank trio `era-bank-core`/`era-bank`/`era-bank-dbo`,
and the industry satellites `era-hotel-pms`, `era-fnb-pos`, `era-clinic`, `era-retail-pos`,
`era-logistics`, `era-construction`, `era-crm`, `era-auto-service`, `era-wholesale`) are **not**
set up by default. Each is its own npm project; install per-app (`npm install`, own `.env`,
`npx prisma migrate deploy`/`db push`, seed) following `docs/SETUP_AND_RUN.md`.

### Infrastructure (start manually — no systemd in this VM)

Postgres 16 and Redis 7 are installed but are **not auto-started on boot**. Start them at the
beginning of a session:

```bash
sudo pg_ctlcluster 16 main start
sudo redis-server /etc/redis/redis.conf   # daemonized; safe to re-run
```

- Postgres role: `era` / `era_dev_password` (superuser), listening on `localhost:5432`.
- All 16 ecosystem databases (`era_orchestrator`, `era_mdm`, `era_finance`, … see
  `docker/postgres/init-databases.sql`) are already created and owned by `era`.
- Redis on `localhost:6379`.

### Env files (gitignored; live in the VM snapshot, not the repo)

`.env` (root), `era-orchestrator/.env`, and `era-finance-core/.env` were created for local dev.
Non-obvious values that are easy to miss:

- `era-finance-core/.env` must set `STORAGE_DRIVER=local`, otherwise `@era/storage` defaults to
  `s3` and the Finance API crashes at boot with `S3_STORAGE: set bucket, ...`.
- `ERA_DEV_UNLOCK_ALL_MODULES=true` unlocks modules without DB billing rows (dev only).
- Postgres password in env files is `era_dev_password` (the example uses placeholders).

### Running the core services

Orchestrator (API + Web together):

```bash
cd era-orchestrator && npm run dev
```

Finance Core — **the web dev script hardcodes `-p 3000`** (`apps/web/package.json`), which
collides with the orchestrator web on 3000. Run the API and Web as separate processes and force
the web onto 3100:

```bash
cd era-finance-core
npm run dev:api                                 # NestJS API on 4100
# in a second shell, web on 3100:
./node_modules/.bin/dotenv -e .env -o -- bash -c "cd apps/web && exec ../../node_modules/.bin/next dev -p 3100 -H 0.0.0.0"
```

### Build/bootstrap caveats

- Shared packages under `packages/*` compile to `dist/` and **must be built before consumers**
  (build order: `i18n-common` → `era-contracts` → `era-storage` → `era-fiscal` → `satellite-kit`).
  The startup update script handles this; after editing a shared package, rebuild it and restart
  the consumer dev server (watch mode does not pick up `node_modules` changes).
- Finance API imports `@erafinance/api-contracts`; if you see `Cannot find module
  '@erafinance/api-contracts'`, run `npm run build -w @erafinance/api-contracts` (in
  `era-finance-core`) and **restart** `dev:api` (nest watch won't auto-recompile a package build).
- DB bootstrap (requires Postgres running):
  - Orchestrator: `node tools/bootstrap-local.mjs --reset-password --skip-finance --skip-satellites`
  - Finance: `cd era-finance-core && npm run db:bootstrap-local` then
    `DATABASE_URL=postgresql://era:era_dev_password@localhost:5432/era_finance?schema=public npx tsx packages/database/prisma/scripts/bootstrap-platform-admins.ts --reset-password`
  - The `--demo` finance seed currently fails on a pre-existing data bug
    (`Template NAS: unresolved parentCode: 133`); use the default (non-demo) seed.
- Platform super-admin login: `inaram84@gmail.com` / `12345678` (also
  `shirinov.chingiz@gmail.com`). API login: `POST http://127.0.0.1:4000/auth/login`.

### Dev-mode gotcha

On the very first hit to a Next.js route, the page can appear blank for several seconds while it
compiles (e.g. post-login `/workspace`). It resolves on its own / after a refresh — not a bug.

### Lint / test

- Orchestrator API: `cd era-orchestrator && npm run test:api` (jest).
- Finance API: `cd era-finance-core && npm run lint -w @erafinance/api`; tests via
  `npm run test -w @erafinance/api` (large suite, several minutes).
