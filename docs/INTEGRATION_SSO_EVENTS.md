# Control plane SSO & satellite event bus

## SSO (Epic A)

- **Issuer:** `era-365-orchestrator` (`POST /auth/login`, `POST /auth/token/refresh`, `POST /auth/sso/exchange`)
- **Consumer:** `era-finance-core` — `ControlPlaneAuthGuard` verifies HS256 JWT (`ERA_JWT_SECRET`, `iss`, `aud`)
- **Rollout:** set `ERA_AUTH_MODE=control-plane` on finance-core API (default `legacy` keeps `JwtAuthGuard` + DB validation)
- **Billing:** `ControlPlaneEntitlementGuard` (renamed from `ControlPlaneGuard`) runs after auth

## Events (Epic B)

1. Hotel PMS checkout → `SATELLITE_HOTEL_RESERVATION_COMPLETED` (`@era/contracts`)
2. `POST http://orchestrator:4100/api/v1/satellite-events` (when `ERA_EVENT_GATEWAY_MODE=orchestrator`)
3. Orchestrator enqueues BullMQ `era-satellite-events`
4. Finance `SatelliteEventWorker` consumes (GL/FIFO placeholders)

Env: see root `.env.example` (`SATELLITE_EVENT_SERVICE_TOKEN`, `ERA_SATELLITE_ORGANIZATION_ID`, etc.).
