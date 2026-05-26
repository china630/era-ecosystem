# Control plane SSO & satellite event bus

## SSO (Epic A — Phase A complete)

- **Issuer:** `era-365-orchestrator` (`POST /auth/login`, `POST /auth/token/refresh`, `POST /auth/sso/exchange`)
- **Consumer:** `era-finance-core` — `ControlPlaneAuthGuard` verifies HS256 JWT (`ERA_JWT_SECRET`, `iss`, `aud`)
- **Rollout:** set `ERA_AUTH_MODE=control-plane` on finance-core API (default `legacy` keeps `JwtAuthGuard` + DB validation)

### CP2 RS256 cutover (staging)

| Env | Orchestrator | Consumers (Finance, satellites) |
|-----|--------------|----------------------------------|
| Local dev | `ERA_JWT_SIGNING_MODE=hs256` (default), `ERA_JWT_SECRET` | `ERA_JWT_VERIFY_MODE=dual`, same secret fallback |
| Staging/prod | `ERA_JWT_SIGNING_MODE=rs256` or `dual`, `ERA_JWT_RS256_JWK` (private JWK JSON) | `ERA_JWT_JWKS_URL=http://orchestrator:4100/.well-known/jwks.json` on Finance API |

**Smoke (staging):**

1. Orchestrator: configure `ERA_JWT_RS256_JWK`; login returns RS256 `accessToken` (when cutover flag enabled).
2. Finance: `ERA_JWT_RS256_JWKS_URL=http://orchestrator:4100/.well-known/jwks.json` (or equivalent) — CP guard accepts RS256 tokens.
3. HS256 remains valid during dual-sign period if both secrets/keys configured.

JWKS endpoint: `era-365-orchestrator/apps/api/src/auth/well-known.controller.ts`. DELIVERY checkbox: [DELIVERY-ORCHESTRATOR.md](../era-365-orchestrator/doc/DELIVERY-ORCHESTRATOR.md) CP2.
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

### RBAC / memberships on industry satellites (hybrid)

Industry apps **do not** expose orchestrator RBAC routes locally (`join-org`, `access-requests`, `transfer-ownership`, `GET /memberships` → **N/A** in matrix §2.1).

| Контур | Где | Пример |
|--------|-----|--------|
| **Платформа** | Orch membership → Finance SSO → `executeSatelliteSsoExchange` | OWNER/DIRECTOR → `BUSINESS_OWNER`; ADMIN/ACCOUNTANT → `PLATFORM_MEMBER` + `financeRole` in JWT |
| **Операции** | Локальная БД спутника | FB `FB_WAITER`, hotel reception — без `financeRole` |

`@era/satellite-kit`: `resolvePlatformCapabilities`, `PlatformAccountBar` (deep links to Finance team/billing), `assertIndustryModuleActive`. Локальный официант **не** получает join-org / billing UI.

Hot + FB: гибрид — local login для ops; SSO для владельца/бухгалтера с Finance launcher.

## Events (Epic B — Phase A complete)

1. Satellite domain action → typed event in `@era/contracts`
2. `POST http://orchestrator:4100/api/v1/satellite-events` (when `ERA_EVENT_GATEWAY_MODE=orchestrator`)
3. Orchestrator validates with `isSatelliteEvent()` and enqueues BullMQ `era-satellite-events`
4. Finance `SatelliteEventWorker` routes by `type` via `SatelliteEventDispatchService`

Local dev stub: each industry app exposes `POST /api/events/dispatch` (forwards to orchestrator when configured).

Env: see root `.env.example` (`SATELLITE_EVENT_SERVICE_TOKEN`, `ERA_SATELLITE_ORGANIZATION_ID`, etc.).

### All 13 ingress event types — worker status

Validated on orchestrator ingress by `isSatelliteEvent()` in [`packages/era-contracts/src/events/satellite-event.ts`](../packages/era-contracts/src/events/satellite-event.ts). Finance routes each `type` in `SatelliteEventDispatchService`.

| Type | Satellite | Finance worker | Result |
|------|-----------|----------------|--------|
| `SATELLITE_HOTEL_RESERVATION_COMPLETED` | era-hotel-pms | `handleHotelReservation` | GL + draft invoice |
| `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` | era-hotel-pms | `handleHotelNightAudit` | Multi-line NAS journal from `revenueLines` + GL map |
| `SATELLITE_HOTEL_INVOICE_ISSUED` | era-hotel-pms | `handleHotelInvoiceIssued` | Draft sales invoice in Finance |
| `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT` | era-hotel-pms | `handleHotelCityLedgerSnapshot` | Agency city-ledger reconciliation meta |
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

**Hotel outbound only** (custom ERP webhooks on `HotelProfile.integrationSettingsJson`; not in `isSatelliteEvent`): `SATELLITE_HOTEL_FOLIO_CHARGE_POSTED`, `SATELLITE_HOTEL_FOLIO_PAYMENT_RECEIVED`, `SATELLITE_HOTEL_FOLIO_CHARGE_VOIDED`, `SATELLITE_HOTEL_MASTER_DATA_SYNC`, `SATELLITE_HOTEL_PAYMENT_FISCALIZED`. See [HOSPITALITY_FINANCE_BOUNDARY.md](./HOSPITALITY_FINANCE_BOUNDARY.md).

Idempotency: table `satellite_events_processed` — replay same `correlationId` → skip (no duplicate postings).

Implementation: [`satellite-event-dispatch.service.ts`](../era-finance-core/apps/api/src/integration/satellite-event-dispatch.service.ts).

Readiness snapshot: [READINESS_MATRIX.md](./READINESS_MATRIX.md).
