# Control plane SSO & satellite event bus

## SSO (Epic A)

- **Issuer:** `era-365-orchestrator` (`POST /auth/login`, `POST /auth/token/refresh`, `POST /auth/sso/exchange`)
- **Consumer:** `era-finance-core` — `ControlPlaneAuthGuard` verifies HS256 JWT (`ERA_JWT_SECRET`, `iss`, `aud`)
- **Rollout:** set `ERA_AUTH_MODE=control-plane` on finance-core API (default `legacy` keeps `JwtAuthGuard` + DB validation)
- **Billing:** `ControlPlaneEntitlementGuard` (renamed from `ControlPlaneGuard`) runs after auth

## RBAC (Epic A2 — target)

**Source of truth:** `era-365-orchestrator` for identity, org membership, **`OWNER`**, transfer ownership, access requests, ownership dispute.

| Claim / API | Used by |
|-------------|---------|
| `organizationId`, `roles[]`, `isOwner` | Finance API guards, satellite SSO session |
| `OWNER` | Billing, subscription, transfer ownership, security audit |
| `BUSINESS_OWNER` (satellite alias) | Mapped from `OWNER` or `DIRECTOR` in JWT for industry apps |

Finance keeps **domain policy** guards (e.g. PROCUREMENT cannot Post ledger) but loads roles from JWT when `ERA_AUTH_MODE=control-plane`.

See [SATELLITE_DOCUMENTATION.md](./SATELLITE_DOCUMENTATION.md) § Identity & RBAC.

## Events (Epic B)

1. Satellite domain action → typed event in `@era/contracts`
2. `POST http://orchestrator:4100/api/v1/satellite-events` (when `ERA_EVENT_GATEWAY_MODE=orchestrator`)
3. Orchestrator validates with `isSatelliteEvent()` and enqueues BullMQ `era-satellite-events`
4. Finance `SatelliteEventWorker` routes by `type` (GL/FIFO placeholders per vertical)

### Event types (by satellite)

| Satellite | Example types |
|-----------|---------------|
| Hotel PMS | `SATELLITE_HOTEL_RESERVATION_COMPLETED` |
| Retail POS | `SATELLITE_RETAIL_SALE_COMPLETED`, `SATELLITE_RETAIL_SHIFT_CLOSED` |
| Logistics | `SATELLITE_LOGISTICS_TRIP_COMPLETED`, `SATELLITE_LOGISTICS_POD_CAPTURED` |
| Construction | `SATELLITE_CONSTRUCTION_PROGRESS_ACT`, `SATELLITE_CONSTRUCTION_MATERIAL_REQUISITION` |
| CRM field | `SATELLITE_CRM_LEAD_QUALIFIED`, `SATELLITE_CRM_VISIT_LOGGED` |
| Auto STO | `SATELLITE_AUTO_WORK_ORDER_CLOSED` |
| Clinic | `SATELLITE_CLINIC_VISIT_COMPLETED`, `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` (planned) |
| Wholesale | `SATELLITE_WHOLESALE_ORDER_SHIPPED` |

Local dev stub: each industry app exposes `POST /api/events/dispatch` (forwards to orchestrator when configured).

Env: see root `.env.example` (`SATELLITE_EVENT_SERVICE_TOKEN`, `ERA_SATELLITE_ORGANIZATION_ID`, etc.).
