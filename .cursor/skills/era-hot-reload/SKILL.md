---
name: era-hot-reload
description: >-
  Start Local Folder Dev (host Node hot reload / Next Fast Refresh) for one ERA
  satellite or core instead of docker compose build. Use when the user says
  reload / релод / hot reload / local folder / npm run dev plus a target
  (clinic, hotel, fnb, orch, finance, …), or wants fast UI iteration without
  rebuilding Docker images.
---

# ERA hot reload (Local Folder Dev)

Canon: [`docs/LOCAL_FOLDER_DEV.md`](../../../docs/LOCAL_FOLDER_DEV.md) · ports: [`docs/ECOSYSTEM_URLS.md`](../../../docs/ECOSYSTEM_URLS.md)

**Goal:** run the named app with `npm run dev` on the host (seconds for HMR), keep infra in Docker. **Do not** `docker compose build` unless the user asked for a prod image.

## Triggers

| User says (examples) | Action |
|----------------------|--------|
| **релод клиники** / **reload clinic** / **hot reload clinic** | Target `clinic` |
| **релод отеля** / **reload hotel** | Target `hotel` |
| **релод fnb** / **reload pos** | Target `fnb-pos` |
| **релод оркестратор** / **reload orch** | Target `orchestrator` |
| **релод финансы** / **reload finance** | Target `finance` |
| **local folder \<name\>** / **npm run dev \<name\>** | Same |

Aliases match `era-git-ship` manifests + Russian names below.

## Target map

| Target | Dir | Host port | Compose service to **stop** (free port) |
|--------|-----|-----------|----------------------------------------|
| `clinic` | `era-clinic` | **3203** | `clinic` |
| `hotel` | `era-hotel-pms` | **3201** | `hotel-pms` |
| `fnb-pos` / `fnb` | `era-fnb-pos` | **3202** | `fnb-pos` |
| `retail-pos` / `retail` | `era-retail-pos` | **3204** | `retail-pos` |
| `logistics` | `era-logistics` | **3205** | `logistics` |
| `construction` | `era-construction` | **3206** | `construction` |
| `crm` | `era-crm` | **3207** | `crm` |
| `auto-service` / `auto` | `era-auto-service` | **3208** | `auto-service` |
| `wholesale` | `era-wholesale` | **3209** | `wholesale` |
| `bank` | `era-bank` | **3210** | `bank` |
| `bank-dbo` | `era-bank-dbo` | **3211** | `bank-dbo` |
| `orchestrator` / `orch` | `era-orchestrator` | web **3000**, api **4000** | `orchestrator` |
| `finance` | `era-finance-core` | web **3100**, api **4100** | `finance-web` + `finance-core` |
| `data-hub` | `era-data-hub` | **4200** | `data-hub` |

Russian aliases: клиника→clinic, отель→hotel, оркестратор→orchestrator, финансы→finance, опт→wholesale, логистика→logistics, стройка→construction, автосервис→auto-service.

## Workflow (agent)

1. **Resolve target** from the user phrase. If ambiguous, ask once.
2. **Infra up** (repo root, do not rebuild images):
   ```powershell
   docker compose up -d postgres redis
   ```
   For SSO into a satellite also keep orch if possible:
   ```powershell
   docker compose up -d postgres redis orchestrator
   ```
   (Skip orch start when the target *is* orchestrator — host will bind 3000/4000.)
3. **Free the app port** — stop the matching compose service so host `npm run dev` can bind:
   ```powershell
   docker compose stop <compose-service>
   ```
4. **Shared packages** (once per clone, or after kit/contracts edit):
   ```powershell
   # from repo root, only if dist missing or packages changed
   cd packages/i18n-common; npm install; npm run build
   cd ../era-contracts; npm install; npm run build
   cd ../satellite-kit; npm install; npm run build
   # clinic also needs clinic-domain when that package changed
   ```
5. **App ready + dev server**:
   ```powershell
   cd <dir>
   if (-not (Test-Path .env) -and (Test-Path .env.example)) { Copy-Item .env.example .env }
   if (-not (Test-Path node_modules)) { npm install }
   # satellites with Prisma:
   npx prisma generate
   npx prisma migrate deploy
   # Schema ahead of DB → /api/auth/me 500 and SSO stuck on "Signing you in…"
   npm run dev
   ```
   Run `npm run dev` **in background** (`block_until_ms: 0`). Watch for ready URL / compiled.
6. **Tell the user** the URL using **`127.0.0.1` only** (not `localhost` — cookie/SSO host split). Example: `http://127.0.0.1:3203`.
7. **Env sanity for satellites** (from root `.env` / app `.env`): `DATABASE_URL` → host Postgres `127.0.0.1:5432`, same `ERA_SSO_SHARED_SECRET` as orch, `AUTH_JWT_SECRET` set. Prefer umbrella org id vars when set.

   **Required:** Docker injects `AUTH_JWT_SECRET` / `ERA_SSO_SHARED_SECRET` / `AUTH_COOKIE_NAME` / service tokens via compose; host `npm run dev` does **not**. Before first reload of a satellite, upsert from **repo root `.env`** into `<dir>/.env` (do not print secret values):

   - `AUTH_JWT_SECRET`, `ERA_SSO_SHARED_SECRET`, `AUTH_COOKIE_NAME` (clinic default `era_clinic_session`)
   - `CONTROL_PLANE_SERVICE_TOKEN` **or** `SATELLITE_EVENT_SERVICE_TOKEN` (snapshot accepts both; do not leave folklore `dev-control-plane-token` on ORCHESTRATOR_INTERNAL while a real event token exists)
   - `SATELLITE_EVENT_SERVICE_TOKEN`, `MDM_INTERNAL_SERVICE_TOKEN`
   - `CONTROL_PLANE_URL` / `ORCHESTRATOR_URL` / `ORCHESTRATOR_EVENT_URL` → `http://127.0.0.1:4000`

   Without a matching orch S2S token, snapshot returns 401 → fail-closed UI `Industry module not active: industry_clinic`. Without `AUTH_JWT_SECRET`, SSO callback fails with `AUTH_JWT_SECRET must be set`.

   **Docker hostname trap:** Sync stores `orchestratorEventUrl=http://orchestrator:4000`. On **host** `npm run dev` the kit rewrites that to `http://127.0.0.1:4000`. Inside Compose keep Docker DNS. Do not pin `ERA_SATELLITE_ORGANIZATION_ID=demo-org`. Do not overlay empty `CONTROL_PLANE_SERVICE_TOKEN` in `docker-compose.prod.yml`.

### Finance / orchestrator extras

- **orchestrator:** `npm run db:generate` then `npm run dev` (api+web).
- **finance:** build contracts+kit first; `npm run dev` (or `dev:api` / `dev:web`). Web proxies `/api` → `:4100`, `/cp` → orch `:4000`.

## Hard rules

- **Never** `docker compose build` as part of this skill unless the user explicitly asks to rebuild the image.
- **Never** mix `localhost` and `127.0.0.1` in the URLs you print or in launch advice.
- Do **not** stop `postgres` / `redis` to free ports.
- If port still busy: find PID / leftover container, stop it; do not kill unrelated processes.
- Chat with the user in **Russian**; commands and paths stay as in the repo.

## Done criteria

- Target `npm run dev` is running (or already was).
- User has the `http://127.0.0.1:<port>` link.
- Matching Docker app container is stopped (or user was told why not).

## Out of scope

- Git ship / droplet deploy → `era-git-ship`
- Full `docker compose build <svc>` → say so and offer ship or explicit rebuild
- Seed/bootstrap unless user asks or app cannot start without it
