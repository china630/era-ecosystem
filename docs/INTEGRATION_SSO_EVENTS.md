# Control plane SSO & satellite event bus

## SSO (Epic A)

- **Issuer:** `era-365-orchestrator` (`POST /auth/login`, `POST /auth/token/refresh`, `POST /auth/sso/exchange`)
- **Consumer:** `era-finance-core` — `ControlPlaneAuthGuard` verifies HS256 JWT (`ERA_JWT_SECRET`, `iss`, `aud`)
- **Rollout:** set `ERA_AUTH_MODE=control-plane` on finance-core API (default `legacy` keeps `JwtAuthGuard` + DB validation)
- **Billing:** `ControlPlaneEntitlementGuard` runs after auth

## RBAC (Epic A2 — implemented S1)

**Source of truth:** `era-365-orchestrator` for identity, org membership, **`OWNER`**, transfer ownership (migration in progress).

| Claim / API | Used by |
|-------------|---------|
| `organizationId`, `role`, `roles[]`, `isOwner` | Finance API guards, satellite SSO session |
| `GET /memberships` | Bearer — list orgs for switcher |
| `POST /auth/switch-organization` | Bearer + `{ organizationId }` — new tokens |
| `BUSINESS_OWNER` (satellite alias) | Mapped from `OWNER` or `DIRECTOR` in SSO exchange body `financeRole` |

Finance keeps **domain policy** guards (e.g. PROCUREMENT cannot Post ledger). With `ERA_AUTH_MODE=control-plane`, roles come from JWT claims.

See [SATELLITE_DOCUMENTATION.md](./SATELLITE_DOCUMENTATION.md) § Identity & RBAC.

### JWT access token payload (orchestrator → Finance)

```json
{
  "sub": "<user-uuid>",
  "email": "user@example.com",
  "organizationId": "<org-uuid>",
  "role": "OWNER",
  "roles": ["OWNER"],
  "isOwner": true,
  "isSuperAdmin": false,
  "iss": "era-365-orchestrator",
  "aud": "era-finance-core"
}
```

Login response also includes `refreshToken` and `claims` mirror.

### Satellite SSO session (`@era/satellite-kit`)

After `POST /api/auth/sso/exchange` on a satellite, session JWT includes:

- `role` — mapped satellite code (`BUSINESS_OWNER` or `SATELLITE_OPERATOR`)
- `roles[]` — includes both when owner
- `organizationId`, `isOwner`, `financeRole`

Use `requireRole(session, 'BUSINESS_OWNER')` for executive routes (pilot: `era-retail-pos/app/executive`).

## Events (Epic B)

1. Satellite domain action → typed event in `@era/contracts`
2. `POST http://orchestrator:4100/api/v1/satellite-events` (when `ERA_EVENT_GATEWAY_MODE=orchestrator`)
3. Orchestrator validates with `isSatelliteEvent()` and enqueues BullMQ `era-satellite-events`
4. Finance `SatelliteEventWorker` routes by `type` (GL/invoice per vertical)

### Event types (by satellite)

| Satellite | Example types |
|-----------|---------------|
| Hotel PMS | `SATELLITE_HOTEL_RESERVATION_COMPLETED` |
| Retail POS | `SATELLITE_RETAIL_SALE_COMPLETED`, `SATELLITE_RETAIL_SHIFT_CLOSED` |
| Logistics | `SATELLITE_LOGISTICS_TRIP_COMPLETED` |
| Construction | `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED` |
| CRM field | `SATELLITE_CRM_LEAD_CONVERTED`, `SATELLITE_CRM_VISIT_LOGGED` |
| Auto STO | `SATELLITE_AUTO_WORK_ORDER_COMPLETED` |
| Clinic | `SATELLITE_CLINIC_VISIT_COMPLETED`, `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` |
| Wholesale | `SATELLITE_WHOLESALE_ORDER_CONFIRMED` |

Local dev stub: each industry app exposes `POST /api/events/dispatch` (forwards to orchestrator when configured).

Env: see root `.env.example` (`SATELLITE_EVENT_SERVICE_TOKEN`, `ERA_SATELLITE_ORGANIZATION_ID`, etc.).
