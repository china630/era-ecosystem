# ERA Ecosystem (Umbrella)

Composable ERP umbrella repository. Global UI/UX: [`DESIGN.md`](./DESIGN.md). Domain PRDs and technical specs live inside each app.

[![CI](https://github.com/china630/era-ecosystem/actions/workflows/ci.yml/badge.svg)](https://github.com/china630/era-ecosystem/actions/workflows/ci.yml)

**Docs:** [`docs/ECOSYSTEM_URLS.md`](./docs/ECOSYSTEM_URLS.md) · [`docs/CI_CD.md`](./docs/CI_CD.md) · [`docs/DEPLOY_DIGITALOCEAN.md`](./docs/DEPLOY_DIGITALOCEAN.md) · [`docs/DEVELOPMENT_ROADMAP.md`](./docs/DEVELOPMENT_ROADMAP.md) · [`docs/SETUP_AND_RUN.md`](./docs/SETUP_AND_RUN.md) · [`docs/SMOKE_ALL_SERVICES.md`](./docs/SMOKE_ALL_SERVICES.md)

**Platform-first (Phase A, 2026-05-25):** orchestrator is source of truth for RBAC/ownership; all industry satellites share `executeSatelliteSsoExchange` with `BUSINESS_OWNER` mapping; Finance supports `ERA_AUTH_MODE=control-plane`; contracts and gov-budget modules are complete. **Phase B** satellite depth is in progress — see roadmap.

## Industry satellites

| App | PRD | Host | Port |
|-----|-----|------|------|
| `era-hotel-pms` | [PRD](era-hotel-pms/PRD.md) | hotel-pms.era-365.online | 3201 |
| `era-fnb-pos` | [PRD](era-fnb-pos/PRD.md) | fnb-pos.era-365.online | 3202 |
| `era-clinic` | [PRD](era-clinic/PRD.md) | clinic.era-365.online | 3203 |
| `era-retail-pos` | [PRD](era-retail-pos/PRD.md) | retail-pos.era-365.online | 3204 |
| `era-logistics` | [PRD](era-logistics/PRD.md) | logistics.era-365.online | 3205 |
| `era-construction` | [PRD](era-construction/PRD.md) | construction.era-365.online | 3206 |
| `era-crm` | [PRD](era-crm/PRD.md) | crm.era-365.online | 3207 |
| `era-auto-service` | [PRD](era-auto-service/PRD.md) | auto-service.era-365.online | 3208 |
| `era-wholesale` | [PRD](era-wholesale/PRD.md) | wholesale.era-365.online | 3209 |

## Core platform

| Path | Role |
|------|------|
| `packages/era-contracts` | Shared event schemas (`@era/contracts`) |
| `packages/i18n-common` | Shared auth/help copy (`@era/i18n-common`) |
| `packages/satellite-kit` | SSO, UI tokens, `AuthLoginCard` (`@era/satellite-kit`) |
| `packages/era-storage` | Local + S3 object storage (`@era/storage`, add-on `platform_storage`) |
| `era-finance-core` | Financial data plane — [PRD](era-finance-core/PRD.md) |
| `era-data-hub` | Reference Data / DaaS (`data.era-365.online`) — [PRD](era-data-hub/PRD.md) |
| `era-orchestrator` | Control plane + **public hub** (`/pricing`, `/help`, `/terms`, `/register`) — [PRD](era-orchestrator/PRD.md) |

**Public hub (Orchestrator `:3000`):** login, registration, pricing, FAQ, terms, partner dashboard. Finance and satellites link via `NEXT_PUBLIC_ORCH_WEB_URL`. Details: [`docs/ECOSYSTEM_URLS.md`](./docs/ECOSYSTEM_URLS.md).

## Quick start (Docker)

```bash
cp .env.example .env
# Hosts: see docs/SMOKE_ALL_SERVICES.md
docker compose up -d --build
```

| Host | Service |
|------|---------|
| `app.era-365.online` | Orchestrator UI (:3000) |
| `api.era-365.online` | Control plane API (:4000) |
| `finance-core.era-365.online` | Finance Web (:3100) |
| `finance-api.era-365.online` | Finance API (:4100, when public) |
| `data.era-365.online` | ERA Data Hub API (:4200) |
| `hotel-pms.era-365.online` … `clinic.era-365.online` | Industry satellites (:3201–3209) |

`finance-core` API is also reachable internally at `http://finance-core:4100`.

## Integration

- SSO & events: [`docs/INTEGRATION_SSO_EVENTS.md`](./docs/INTEGRATION_SSO_EVENTS.md)
