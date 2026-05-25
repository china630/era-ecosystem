# ERA Ecosystem (Umbrella)

Composable ERP umbrella repository. Global UI/UX: [`DESIGN.md`](./DESIGN.md). Domain PRDs and technical specs live inside each app.

**Docs:** [`docs/DEVELOPMENT_ROADMAP.md`](./docs/DEVELOPMENT_ROADMAP.md) · [`docs/SATELLITE_DOCUMENTATION.md`](./docs/SATELLITE_DOCUMENTATION.md) · [`docs/SETUP_AND_RUN.md`](./docs/SETUP_AND_RUN.md) · [`docs/SMOKE_ALL_SERVICES.md`](./docs/SMOKE_ALL_SERVICES.md)

**Platform-first (Phase A, 2026-05-25):** orchestrator is source of truth for RBAC/ownership; all 7 industry satellites share `executeSatelliteSsoExchange` with `BUSINESS_OWNER` mapping; Finance supports `ERA_AUTH_MODE=control-plane`; contracts and gov-budget modules are complete. **Phase B** satellite depth is in progress — see roadmap.

## Industry satellites

| App | PRD | Host | Port |
|-----|-----|------|------|
| `era-hotel-pms` | [PRD](era-hotel-pms/PRD.md) | hotel.era.az | 3000 |
| `era-fb-pos` | [PRD](era-fb-pos/PRD.md) | pos.era.az | 3200 |
| `era-retail-pos` | [PRD](era-retail-pos/PRD.md) | retail.era.az | 3300 |
| `era-logistics` | [PRD](era-logistics/PRD.md) | logistics.era.az | 3301 |
| `era-construction` | [PRD](era-construction/PRD.md) | construction.era.az | 3302 |
| `era-crm-field` | [PRD](era-crm-field/PRD.md) | crm.era.az | 3303 |
| `era-auto-sto` | [PRD](era-auto-sto/PRD.md) | auto.era.az | 3304 |
| `era-wholesale` | [PRD](era-wholesale/PRD.md) | wholesale.era.az | 3305 |
| `era-clinic` | [PRD](era-clinic/PRD.md) | clinic.era.az | 3306 |

## Core platform

| Path | Role |
|------|------|
| `packages/era-contracts` | Shared event schemas (`@era/contracts`) |
| `packages/satellite-kit` | Shared gateway helpers (`@era/satellite-kit`) |
| `era-finance-core` | Financial data plane — [PRD](era-finance-core/PRD.md) |
| `era-365-orchestrator` | Control plane — [PRD](era-365-orchestrator/PRD.md) |

## Quick start (Docker)

```bash
cp .env.example .env
# Hosts: see docs/SMOKE_ALL_SERVICES.md
docker compose up -d --build
```

| Host | Service |
|------|---------|
| `app.era.az` | Orchestrator UI |
| `api.era.az` | Control plane API |
| `hotel.era.az` | Hotel PMS |
| `pos.era.az` | F&B POS |
| `retail.era.az` … `clinic.era.az` | Industry satellites |

`finance-core` is internal only (`http://finance-core:4000`).

## Integration

- SSO & events: [`docs/INTEGRATION_SSO_EVENTS.md`](./docs/INTEGRATION_SSO_EVENTS.md)
