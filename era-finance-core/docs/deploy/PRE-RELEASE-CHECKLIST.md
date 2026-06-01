# Pre-Release Checklist (Finance ERP)

Use before tagging a **Finance data-plane** release. Platform billing/SSO changes ship with **era-orchestrator** ([CP-BILLING-MIGRATION.md](../../../docs/CP-BILLING-MIGRATION.md)).

**Full stack smoke:** [docs/SMOKE_ALL_SERVICES.md](../../../docs/SMOKE_ALL_SERVICES.md).

## Runtime & ORM

- [x] Node **22**, Postgres **16**, Redis **7**, Prisma **7** — see [deploy/README.md](./README.md).

## On-call — env and guards

**Env:** root `.env`, then `apps/api/.env` (overrides) — `load-env-paths.ts`.

| Variable | Role |
|----------|------|
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Auth (align with orchestrator when `ERA_AUTH_MODE=control-plane`) |
| `DATABASE_URL`, `REDIS_URL` | Data / queues |
| `ERA_AUTH_MODE`, `ERA_CONTROL_PLANE_RBAC_PROXY`, `NEXT_PUBLIC_CONTROL_PLANE_URL` | CP cutover |
| `AUDIT_HASH_SECRET`, `STEP_UP_HMAC_SECRET`, `SMTP_*`, `S3_*` | Audit, step-up, mail, storage |

**`APP_GUARD` order:** `ThrottlerGuard` → `JwtAuthGuard` → `DisputeFreezeGuard` → `SubscriptionReadOnlyGuard` → `BillingAccessGuard` → `AuditorMutationGuard`.

`npm run audit:verify` — **`AUDIT_VERIFY_STRICT=1`** on staging DB copies.

## Before production deploy

- [ ] Backup (`scripts/backup-db.sh`, [DR_RUNBOOK.md](./DR_RUNBOOK.md)).
- [ ] `npm run db:migrate:deploy` (or `db:deploy` with i18n).
- [ ] `npm run build` (`i18n:audit` included).
- [ ] If `packages/i18n` changed: `npm run i18n:catalog` + commit catalog JSON.
- [ ] Smoke: auth, ledger read, `GET /api/health`.
- [ ] CP aligned: login via Orch, Finance API accepts same JWT.

## Go-live smoke

| Area | Checks |
|------|--------|
| Auth | Login, refresh, org switcher, health |
| Core | Counterparty, invoice, trial balance / OSV |
| Payroll / Banking | If modules enabled |

**i18n:** `db:deploy` or `db:sync-i18n` on target after i18n PR.

**In-app help:** `/help` (i18n `help.*`). Legal footer only: `TERMS`, `PRIVACY`, `STATUS` — `apps/web/.env.example`.

**Tag cut:** `npm run build` + `db:migrate:deploy` + smoke above.
