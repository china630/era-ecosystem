# v3 Workforce — clean cutover runbook

**Plan E** execution guide for greenfield / empty DB. No strangler, no Finance→CP data migration.

Related: [cp-core-workforce-hub.md](../adr/cp-core-workforce-hub.md) · Plans A–D in `.cursor/plans/v3_*`

---

## Monorepo build order (E0)

Build packages before apps when schema or contracts change:

1. `packages/era-contracts` — workforce + hr event schemas
2. `packages/satellite-kit` — workforce policy + MDM clients
3. `era-orchestrator` — API + web (CP workforce hub)
4. `era-finance-core` — payroll mirror consumers + slim Employee
5. Industry satellites — clinic, hotel-pms, fnb-pos provision handlers
6. Root `docs/` + `scripts/audit-*`

```powershell
npm run build -w @era/contracts
npm run build -w @era/satellite-kit
npm run build -w @era365/api
```

**Dev flag removed at E1:** `ERA_WORKFORCE_V3` is not used — CP workforce routes are always on when entitled.

---

## Migration manifest (E2)

Apply after Plans A–D schema PRs are merged:

| Database | Command |
|----------|---------|
| `era_orchestrator` | `npm run db:migrate:deploy -w @era365/database` |
| `era_mdm` | `npm run db:migrate:deploy -w @era365/mdm-database` |
| `era_finance` | `npm run db:migrate -w @erafinance/database` |
| `era_clinic`, `era_hotel_pms`, `era_fnb_pos` | `npx prisma migrate deploy` or `db push` per app |

---

## Local bootstrap

```powershell
# Full stack migrations + optional workforce Nafta seed
node tools/bootstrap-local.mjs --migrate-satellites --workforce-seed

# Workforce-only seed (orchestrator must be up + token in env)
$env:ORCH_SUPER_ADMIN_TOKEN = "..."
$env:ERA_HOTEL_ORGANIZATION_ID = "..."
node scripts/nafta-onboard-departments.mjs
```

Skip workforce: `--skip-workforce` (default when flag omitted).

---

## Nafta Docker rebuild

```powershell
docker build -f docker/Dockerfile.packages .
docker compose build orchestrator finance-core finance-web hotel-pms fnb-pos clinic
docker compose up -d
node tools/bootstrap-local.mjs --migrate-satellites --workforce-seed
```

Health checks:

- `GET /platform/v1/workforce/policy?satelliteKey=industry_clinic&organizationId=…` → `hireMode: cp_workforce`
- Orchestrator web `/workspace/workforce` loads
- `node scripts/v3-workforce-smoke.mjs`

---

## Crypto alignment

Ensure `.env` shares across orchestrator + finance:

- `PII_ENCRYPTION_KEY`
- `PII_BLIND_INDEX_KEY`

---

## CI audit (E3)

```powershell
node scripts/audit-data-model-integration.mjs
npm run audit:integration -- --strict
node --test scripts/__tests__/v3-workforce-cutover.spec.mjs
```

Baseline: `scripts/audit-baselines/integration-audit.baseline.json` — empty for v3 exit.

---

## Git ship order (E5)

When user requests **полный коммит** / v3 wave, use [era-git-ship](../../.cursor/skills/era-git-ship/SKILL.md):

1. `packages/era-contracts` + `packages/satellite-kit`
2. `era-orchestrator` (MDM batch + workforce modules + web)
3. `era-finance-core` (consumers + slim Employee)
4. `era-clinic`, `era-fnb-pos`, `era-hotel-pms`
5. Root `docs/` + `scripts/audit-*`
6. `tools/bootstrap-local.mjs`, `docker/`

One PR to `dev` per bullet or grouped 1+2 — do not merge partial waves without E1 legacy removal.

---

## v3 exit checklist

- [ ] Plans A–D complete
- [ ] No `finance_hr`, `local_master`, Finance STAFF publish, clinic practitioner POST create
- [ ] Migrations applied; Nafta docker stack up; `--workforce-seed` runs
- [ ] `audit:integration --strict` green
- [ ] Nafta UAT §6 Workforce v3 pass
- [ ] Master ADR [cp-core-workforce-hub.md](../adr/cp-core-workforce-hub.md) published
- [ ] Plan F: export UI, seat API, construction timesheet events (Nafta §7)

## Plan F — monthly 1C export (Nafta)

1. OWNER → `/workspace/workforce/export` → download roster + absences CSV.
2. Hand off to 1C operator (manual import — no HTTP integration in MVP).
3. Optional: approved construction timesheet CSV for site payroll.
4. Smoke: `node scripts/v3-workforce-f-smoke.mjs`
