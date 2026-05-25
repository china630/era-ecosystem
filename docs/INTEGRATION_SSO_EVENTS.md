# Control plane SSO & satellite event bus

## SSO (Epic A — Phase A complete)

- **Issuer:** `era-365-orchestrator` (`POST /auth/login`, `POST /auth/token/refresh`, `POST /auth/sso/exchange`)
- **Consumer:** `era-finance-core` — `ControlPlaneAuthGuard` verifies HS256 JWT (`ERA_JWT_SECRET`, `iss`, `aud`)
- **Rollout:** set `ERA_AUTH_MODE=control-plane` on finance-core API (default `legacy` keeps `JwtAuthGuard` + DB validation)
- **Billing:** `ControlPlaneEntitlementGuard` runs after auth; `isOwner` from JWT for owner-only routes

## RBAC (Epic A2 — orchestrator source of truth)

**Source of truth:** `era-365-orchestrator` for identity, org membership, **`OWNER`**, transfer ownership, access requests, ownership disputes.

Finance keeps **domain policy** guards (e.g. PROCUREMENT cannot Post ledger). With `ERA_AUTH_MODE=control-plane`, roles come from JWT claims.

When `ERA_CONTROL_PLANE_RBAC_PROXY=true` (default), Finance forwards RBAC mutations to orchestrator while preserving legacy route paths for clients.

| Claim / API | Used by |
|-------------|---------|
| `organizationId`, `role`, `roles[]`, `isOwner` | Finance API guards, satellite SSO session |
| `GET /memberships` | Bearer — list orgs for switcher |
| `POST /auth/switch-organization` | Bearer + `{ organizationId }` — new tokens |
| `BUSINESS_OWNER` (satellite alias) | Mapped from `OWNER` or `DIRECTOR` via `executeSatelliteSsoExchange` |

### Orchestrator RBAC endpoints (canonical)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/auth/join-org` | Authenticated user | Request access to org by VÖEN (`taxId`, optional `message`) |
| GET | `/team/access-requests` | `OWNER`, `ADMIN` | List pending join requests for active org |
| POST | `/team/access-requests/:id/approve` | `OWNER`, `ADMIN` | Approve request; body `{ role? }` |
| POST | `/team/access-requests/:id/decline` | `OWNER`, `ADMIN` | Decline request |
| POST | `/organizations/transfer-ownership` | `OWNER` | Transfer org ownership `{ newOwnerUserId }` |
| POST | `/admin/organizations/:organizationId/disputes` | Super-admin | Open ownership dispute |
| GET | `/admin/organizations/:organizationId/disputes` | Super-admin | List disputes for org |
| GET | `/admin/organizations/:organizationId/security-state` | Super-admin | Org freeze / dispute mode |
| PATCH | `/admin/organizations/:organizationId/disputes/:disputeId/status` | Super-admin | Update dispute status |
| POST | `/admin/organizations/:organizationId/disputes/:disputeId/execute` | Super-admin | Execute approved transfer |
| GET | `/public/disputes/:id/meta` | Public + token | Counter-claim metadata |
| POST | `/public/disputes/:id/counter-claim` | Public + token | Record incumbent counter-claim |

Finance proxy routes (same Bearer token, forwarded when `ERA_CONTROL_PLANE_RBAC_PROXY=true`):

- `POST /api/auth/join-org`
- `GET /api/team/access-requests`
- `POST /api/team/access-requests/:id/approve|decline`
- `POST /api/organizations/transfer-ownership`

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

Industry apps call **`executeSatelliteSsoExchange(body, prisma)`** from `packages/satellite-kit/src/auth/sso-exchange.ts`.

After `POST /api/auth/sso/exchange` on a satellite, session JWT includes:

- `role` — mapped satellite code (`BUSINESS_OWNER` or `SATELLITE_OPERATOR`)
- `roles[]` — includes both when owner
- `organizationId`, `isOwner`, `financeRole`

Use `requireRole(session, 'BUSINESS_OWNER')` for executive routes (pilot: `era-retail-pos/app/executive`).

## Events (Epic B — Phase A complete)

1. Satellite domain action → typed event in `@era/contracts`
2. `POST http://orchestrator:4100/api/v1/satellite-events` (when `ERA_EVENT_GATEWAY_MODE=orchestrator`)
3. Orchestrator validates with `isSatelliteEvent()` and enqueues BullMQ `era-satellite-events`
4. Finance `SatelliteEventWorker` routes by `type` via `SatelliteEventDispatchService`

Local dev stub: each industry app exposes `POST /api/events/dispatch` (forwards to orchestrator when configured).

Env: see root `.env.example` (`SATELLITE_EVENT_SERVICE_TOKEN`, `ERA_SATELLITE_ORGANIZATION_ID`, etc.).

### All 11 event types — worker status

| Type | Satellite | Finance worker | Result |
|------|-----------|----------------|--------|
| `SATELLITE_HOTEL_RESERVATION_COMPLETED` | era-hotel-pms | `handleHotelReservation` | GL + draft invoice |
| `SATELLITE_RETAIL_SALE_COMPLETED` | era-retail-pos | `handleRetailSale` | GL + draft invoice |
| `SATELLITE_RETAIL_SHIFT_CLOSED` | era-retail-pos | `handleRetailShiftClosed` | Cash recon log (meta only) |
| `SATELLITE_LOGISTICS_TRIP_COMPLETED` | era-logistics | `handleLogisticsTrip` | GL posting |
| `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED` | era-construction | `handleConstructionAct` | GL + draft invoice |
| `SATELLITE_CRM_LEAD_CONVERTED` | era-crm-field | `handleCrmLead` | GL + draft invoice |
| `SATELLITE_CRM_VISIT_LOGGED` | era-crm-field | `handleCrmVisitLogged` | Activity log (meta only) |
| `SATELLITE_AUTO_WORK_ORDER_COMPLETED` | era-auto-sto | `handleAutoSto` | GL + draft invoice |
| `SATELLITE_CLINIC_VISIT_COMPLETED` | era-clinic | `handleClinicVisit` | GL + draft invoice |
| `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` | era-clinic | `handleClinicLabOrder` | GL + draft invoice |
| `SATELLITE_WHOLESALE_ORDER_CONFIRMED` | era-wholesale | `handleWholesaleOrder` | GL + draft invoice |

Idempotency: table `satellite_events_processed` — replay same `correlationId` → skip (no duplicate postings).

Implementation: [`satellite-event-dispatch.service.ts`](../era-finance-core/apps/api/src/integration/satellite-event-dispatch.service.ts).
