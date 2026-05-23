# ERA Ecosystem (Umbrella)

Composable ERP umbrella repository. Global UI/UX: [`DESIGN.md`](./DESIGN.md). Domain PRDs and technical specs live inside each submodule only.

**Setup & run (RU):** [`docs/SETUP_AND_RUN.md`](./docs/SETUP_AND_RUN.md) — настройка и запуск каждой системы (Docker, локально, env, порты, SSO, events).

## Layout

| Path | Role |
|------|------|
| `packages/era-contracts` | Shared TypeScript types & event schemas |
| `era-finance-core` | Financial data plane (submodule) |
| `era-365-orchestrator` | Control plane — billing, identity, SSO (submodule) |
| `era-hotel-pms` | Hotel industry satellite (submodule) |
| `era-fb-pos` | F&B POS satellite — floor, KDS, tickets (submodule) |

## Submodules

```bash
git submodule update --init --recursive
```

## Quick start (Docker — full stack)

Traefik uses **file-based** routing (`traefik/traefik.yml` + `traefik/dynamic.yml`) — no Compose labels on apps.

```bash
cp .env.example .env
# Add to hosts: 127.0.0.1 app.era.az api.era.az hotel.era.az pos.era.az
docker compose up -d --build
```

After first start, run DB migrations per service — see [`docs/SETUP_AND_RUN.md`](./docs/SETUP_AND_RUN.md#3-запуск-всего-стека-в-docker-рекомендуется).

| Host | Service | Internal URL |
|------|---------|----------------|
| `app.era.az` | Orchestrator UI | `http://orchestrator:3100` |
| `api.era.az` | Control plane API | `http://orchestrator:4100` |
| `hotel.era.az` | Hotel PMS | `http://hotel-pms:3000` |
| `pos.era.az` | F&B POS | `http://fb-pos:3200` |

`finance-core` is **not** on Traefik — internal only at `http://finance-core:4000`.

Traefik dashboard: http://localhost:8080

## Local development (single service)

| Service | Directory | Dev command | Default port |
|---------|-----------|-------------|--------------|
| Orchestrator | `era-365-orchestrator` | `npm run dev` | API 4100, Web 3100 |
| Finance | `era-finance-core` | `npm run dev` | API 4000, Web 3000 |
| Hotel PMS | `era-hotel-pms` | `npm run dev` | 3000 |
| F&B POS | `era-fb-pos` | `npm run dev` | 3200 |
| Contracts | `packages/era-contracts` | `npm run build` | — |

Infra only: `docker compose up -d postgres redis` from repo root.

Full env variables, SSO, and event bus: [`docs/SETUP_AND_RUN.md`](./docs/SETUP_AND_RUN.md).

## Integration

- SSO & satellite events: [`docs/INTEGRATION_SSO_EVENTS.md`](./docs/INTEGRATION_SSO_EVENTS.md)
