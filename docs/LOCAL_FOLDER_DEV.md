# Local development from a monorepo subfolder

Work on **one app** (`era-finance-core`, `era-hotel-pms`, `era-orchestrator`, …) inside the umbrella repo without splitting git repos.

Related: [`SETUP_AND_RUN.md`](./SETUP_AND_RUN.md) · [`ECOSYSTEM_URLS.md`](./ECOSYSTEM_URLS.md)

---

## Prerequisites

From repo root:

```bash
docker compose up -d postgres redis
```

Or run the full stack: `docker compose up -d`.

---

## Shared packages (build once per clone)

| Package | Path | Consumers |
|---------|------|-----------|
| `@era/i18n-common` | `packages/i18n-common` | satellites, Orch web |
| `@era/contracts` | `packages/era-contracts` | Orch API, Finance API, hotel |
| `@era/satellite-kit` | `packages/satellite-kit` | all industry satellites, Finance web (shell) |
| `@era/storage` | `packages/storage` | Finance API (optional) |

```bash
cd packages/i18n-common && npm install && npm run build
cd ../era-contracts && npm install && npm run build
cd ../satellite-kit && npm install && npm run build
```

After changing kit or contracts, rebuild the package and restart the app dev server.

---

## Port matrix

| Service | Umbrella `docker compose` | Bare `npm run dev` (typical) |
|---------|---------------------------|------------------------------|
| Orchestrator Web | 3000 | 3000 |
| Orchestrator API (control plane) | **4000** | **4000** |
| Finance Web | **3100** | **3100** |
| Finance API | **4100** (internal; web proxies `/api`) | **4100** |
| Hotel PMS | **3201** | **3000** (standalone `era-hotel-pms/docker-compose`) |
| F&B POS | **3202** | varies |
| PostgreSQL | 5432 | 5432 |
| Redis | 6379 | 6379 |

`CONTROL_PLANE_URL` / `NEXT_PUBLIC_CONTROL_PLANE_URL` → **`http://127.0.0.1:4000`** (Orchestrator API, not Finance).

---

## Bootstrap & seed

| Goal | Command |
|------|---------|
| Full local demo (Orch + Finance + credentials file) | From root: `node tools/bootstrap-local.mjs` or `npm run bootstrap:local` |
| Finance DB only | `cd era-finance-core && npm run db:bootstrap-local` |
| Hotel DB only | `cd era-hotel-pms && npx prisma migrate deploy && npm run db:seed` |
| Orch DB only | `cd era-orchestrator && npm run db:generate && npx prisma migrate deploy` |

Use bootstrap when you need platform super-admin, demo org, and cross-app SSO smoke. Per-app seed is enough for isolated feature work.

---

## Per-app quick start

### era-orchestrator

```bash
cd era-orchestrator
cp .env.example .env
npm install && npm run db:generate && npm run dev
```

### era-finance-core

```bash
cd era-finance-core
cp .env.example .env
# Build packages/era-contracts + packages/satellite-kit first
npm install && npm run db:bootstrap-local && npm run dev
```

Web: http://127.0.0.1:3100 · API: http://127.0.0.1:4100/api/health

### era-hotel-pms

**Umbrella Docker:** app on **3201**.  
**Standalone** (`era-hotel-pms/docker-compose.yml`): app on **3000**.

```bash
cd era-hotel-pms
cp .env.example .env.local
npm install && npx prisma migrate deploy && npm run db:seed && npm run dev
```

Set `NEXT_PUBLIC_FINANCE_WEB_URL=http://127.0.0.1:3100` when Finance runs in the umbrella stack.

---

## Cursor / AI agents

- Scope context to the subfolder you are editing (`era-hotel-pms/**`, `era-finance-core/**`).
- Pull infra URLs and port conventions from **repo root** `.env.example` and this doc — not from obsolete submodule READMEs.
- UI shell contract: [`DESIGN.md`](../DESIGN.md) § App shell · [`UI_PLAYBOOK_SATELLITES.md`](./UI_PLAYBOOK_SATELLITES.md).

---

## Common mistakes

| Symptom | Fix |
|---------|-----|
| `Cannot find module '@era/satellite-kit'` | Build `packages/satellite-kit` |
| CP billing / tier bar empty | `CONTROL_PLANE_URL` must point to Orch **:4000** |
| Hotel Finance links open wrong host | `NEXT_PUBLIC_FINANCE_WEB_URL=http://127.0.0.1:3100` |
| Auth SSO fails locally | Same `ERA_JWT_SECRET` / `AUTH_JWT_SECRET` across Orch + satellite per `INTEGRATION_SSO_EVENTS.md` |
