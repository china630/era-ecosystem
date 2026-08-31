# Control plane SSO & satellite event bus

## Public hub (Orchestrator web)

Marketing and onboarding routes live on **Orchestrator web** (`NEXT_PUBLIC_ORCH_WEB_URL`, default `:3000`): `/login`, `/register`, `/register-org`, `/pricing`, `/help`, `/terms`, `/partner`. Finance and satellites link out via `orchPublicHref()`; Finance `/pricing` and `/register*` redirect to Orch. Canonical FAQ: Orch `/help`. See [ECOSYSTEM_URLS.md](./ECOSYSTEM_URLS.md).

## SSO (Epic A — Phase A complete)

### Satellite launch HMAC (industry apps)

- **Launch base URL (Wave 8):** owner Open resolves `baseUrl` from orchestrator `SatelliteEndpoint` via `GET /v1/satellites/launch-url?satelliteKey=…` (JWT + org context). Registry row wins; if missing/disabled, API falls back to `NEXT_PUBLIC_SATELLITE_*` / `ERA_*_ORIGIN` (local-dev). Client `satelliteUrlForItem()` remains a last-resort webpack-inlined fallback only — not production SoR. Super-admin still CRUD endpoints at `v1/admin/orgs/:orgId/satellite-endpoints`.
- **Mint:** `POST /auth/satellite-sso-ticket` (JWT required) — only for an **active membership** of the caller; `financeRole` comes from membership (not client default `OWNER`); includes one-time `jti`.
- **Payload v3 (preferred):** `email|organizationId|expiresAt|financeRole|jti` signed with `ERA_SSO_SHARED_SECRET`.
- **Payload v2:** `email|organizationId|expiresAt|financeRole` (still accepted).
- **Payload v1 (legacy):** `email|organizationId|expiresAt` — still verifies, but satellites **force** `financeRole=USER` (unsigned query role is ignored). See [SECURITY_HYGIENE_PROGRAM.md](./SECURITY_HYGIENE_PROGRAM.md) SEC-SSO-02.
- **Browser callback:** kit `SsoCallbackPage` (`/sso/callback`) must forward query `jti` (and `financeRole`) into `POST /api/auth/sso/exchange`. Dropping `jti` makes v3 HMAC fail as “Invalid SSO signature” even when secrets match.
- **Exchange:** satellite `POST /api/auth/sso/exchange` via `resolveVerifiedSsoFinanceRole` + `consumeSsoSignatureOnce` (SEC-SSO-01 process-local replay guard; Redis planned for multi-instance). When deployment org is bound (`ERA_SATELLITE_ORGANIZATION_ID` or runtime bind via `satelliteOrganizationId()`), ticket org must match (SEC-SSO-05). See ADR [`satellite-organization-bind.md`](adr/satellite-organization-bind.md).

### Agency portal SSO (hotel B2B extranet)

- **ADR:** [`hotel-agency-portal.md`](adr/hotel-agency-portal.md). Identity SoR = orchestrator `AgencyPortalAccount` + `AgencyPropertyGrant` (not `OrganizationMembership`).
- **Mint:** orchestrator after agency password login + property pick — HMAC with `ERA_SSO_SHARED_SECRET`.
- **Payload:** `agency|{email}|{organizationId}|{agencyId}|{expiresAt}` (+ optional `|jti`). Distinct from owner/staff satellite launch.
- **Exchange:** hotel `POST /api/auth/agency-sso/exchange` → cookie `era_agency_session`. Must **not** map into `Hotel_Admin` / staff roles.
- **Scope:** `/agency/*` and `/api/agency/*` only; FO inbox uses staff session.

- **Issuer:** `era-orchestrator` (`POST /auth/login`, `POST /auth/token/refresh`, `POST /auth/sso/exchange`, `POST /auth/finance-handoff`)
- **Consumer:** `era-finance-core` — `ControlPlaneAuthGuard` and `provisionFromControlPlane` both use `verifyControlPlaneAccessToken` (`ERA_JWT_SECRET` / JWKS, `iss`, `aud`)
- **Handoff:** browser → Orchestrator one-time Redis ticket (`POST /auth/finance-handoff`) → Finance `/auth/cp-handoff` redeems at Orchestrator → stores **CP access + refresh** in `sessionStorage` (`erafinance_cp_*`) → `POST /auth/cp-provision` mints Finance-local session (`erafinance_access_token`). Legacy `?token=` only when CP access JWT is still valid (also stored as CP access for billing proxies).
- **Super-admin:** handoff ticket falls back to the first Orchestrator membership when the JWT has no `organizationId`. Finance `cp-provision` always attaches a local org (existing membership, first Finance org, or a platform placeholder) — never a no-company session that bounces to `/login`. VÖEN is optional when provisioning from the control plane.
- **Finance login form:** if the local user is missing or has `sso:no-password`, Finance verifies email+password at Orchestrator `POST /auth/login` and then runs the same `cp-provision` path as workspace Open. A local bcrypt password is used only when one is actually set. SSO attach prefers an existing Finance company; a new org is created only when none exist, after ensuring `currencies.code=AZN` (`organizations_currency_fkey`).
- **Dual browser tokens:** Finance ERP APIs use the Finance-local JWT. Control-plane proxies (`resolveApiUrl` → `/cp/v1/subscription`, billing, partner, …) use the CP JWT. A 401 from Orchestrator must **not** clear the Finance session or redirect to `/login` (soft-fail + optional `POST /cp/auth/token/refresh`).
- **Rollout:** set `ERA_AUTH_MODE=control-plane` on finance-core API (default `legacy` keeps `JwtAuthGuard` + DB validation)
- **Auth secret:** `ERA_JWT_SECRET` only (Finance `JWT_SECRET` removed). PII/audit use dedicated keys — see [ADR control-plane-jwt-keys](./adr/control-plane-jwt-keys.md).

### CP2 RS256 cutover (staging)

| Env | Orchestrator | Consumers (Finance, satellites) |
|-----|--------------|----------------------------------|
| Local Docker | `ERA_JWT_SIGNING_MODE=dual`, `ERA_JWT_RS256_JWK_FILE` (+ HS256 `ERA_JWT_SECRET`) | `ERA_JWT_VERIFY_MODE=dual`, `ERA_JWT_JWKS_URL=http://orchestrator:4000/.well-known/jwks.json` |
| Staging/prod | `ERA_JWT_SIGNING_MODE=rs256` or `dual`, `ERA_JWT_RS256_JWK` (private JWK JSON) | `ERA_JWT_JWKS_URL` pointing at Orchestrator JWKS |

**Smoke (staging):**

1. Orchestrator: configure `ERA_JWT_RS256_JWK` / `_FILE`; login returns RS256 `accessToken` when signing mode is `dual`/`rs256`.
2. Finance: `ERA_JWT_JWKS_URL=http://orchestrator:4000/.well-known/jwks.json` — CP guard and cp-provision accept RS256 tokens.
3. HS256 remains valid during dual period if `ERA_JWT_SECRET` is set on both sides.

JWKS endpoint: `era-orchestrator/apps/api/src/auth/well-known.controller.ts` (`GET /.well-known/jwks.json`). DELIVERY checkbox: [DELIVERY-ORCHESTRATOR.md](../era-orchestrator/doc/DELIVERY-ORCHESTRATOR.md) CP2.
- **Billing:** `ControlPlaneEntitlementGuard` runs after auth; `isOwner` from JWT for owner-only routes

## RBAC (Epic A2 — orchestrator source of truth)

**Source of truth:** `era-orchestrator` for identity, org membership, **`OWNER`**, transfer ownership, access requests, ownership disputes.

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
  "iss": "era-orchestrator",
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

**Platform super-admin (full access everywhere).** Emails in `PLATFORM_SUPER_ADMIN_EMAILS` (`@era/satellite-kit` `isPlatformSuperAdminUser`) always see the complete satellite feature set, independent of role/permission data:

- `executeSatelliteSsoExchange` maps them to `BUSINESS_OWNER` (`isOwner=true`) on every SSO login.
- Shared gates bypass for them regardless of stored role: `sessionHasRole` returns `true` for any role, and `resolvePlatformCapabilities`/`hasPlatformCapability` return owner capabilities. Requires `email`/`login` on the session (SSO puts `email` in the JWT).
- Hotel PMS uses its own permission model: `useAuth.can()`, `/api/auth/me`, and `assertPermission` grant the full `PERMISSIONS` set to super-admins.

When editing these gates, keep the bypass — never regress a super-admin to a role-limited view.

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

**Organization bind (appliance / on-prem):** after Connect + saving `SatelliteEndpoint` base URLs, Super-admin **Sync satellite bindings** calls `POST /v1/admin/orgs/:orgId/sync-satellite-bindings`, which fan-outs to each industry key in `INDUSTRY_SATELLITE_KEYS` (includes `industry_banking`) plus `finance_core` → `POST /api/internal/v1/organization/bind` (Bearer `SATELLITE_EVENT_SERVICE_TOKEN`). Bank surfaces: `era-bank`, `era-bank-dbo`, `era-bank-core` (Nest path excluded from `/api/v1` prefix so Sync URL matches). Persistence: runtime + DB table `_era_organization_bind` + `.data/organization-bind.json`. Boot: `onSatelliteBoot({ prisma })` hydrates bind (+ runtime config) before first request. Production refuses silent `demo-org`. **Deny:** missing/wrong Bearer → **401** (`assertEnvServiceToken`). ADR: [`docs/adr/satellite-organization-bind.md`](adr/satellite-organization-bind.md).

**Desired-state runtime config (industry API — Wave 2+6):** same Sync also POSTs `POST /api/internal/v1/runtime-config` (event URL, public base URL, PSA emails, SSO shared secret ≥16, event token, `activeModules` / optional `hotelModules`, optional `deploymentTopology` + `edition`). Receivers: hotel/clinic/fnb + thin industry (retail/crm/auto/construction/wholesale/logistics) + bank/dbo + Finance Nest + bank-core Nest (absolute `/api/internal/v1/*`, excluded from `/api/v1` prefix). Kit store: `_era_runtime_config` + `.data/runtime-config.json`; env = bootstrap override. Finance Nest resolves orch URL via `@era/satellite-kit` `resolveOrchestratorBaseUrl()` (memory first; `CONTROL_PLANE_URL` install bootstrap). `deploymentTopology` is informational — never skip tenant filter. Boot: Next `instrumentation.ts` / Nest bootstrap via `onSatelliteBoot`. **Deny:** missing Bearer → **401**; `ssoSharedSecret` shorter than 16 → **400** (Zod / class-validator); orch Sync omits secrets `<16` rather than pushing them.

**Entitlement fail-closed (Wave 9):** satellites use `*-module-gate.ts` / `requireSatelliteModule` — inactive module → 403 (ops) or cron skip. Kit `ERA_DEV_UNLOCK_ALL_MODULES=1` is ignored when `NODE_ENV=production` (prod refuses DEV unlock). **Request org as an argument** (session / `x-era-organization-id`) — not ALS `enterWith` across Next `await`. Kit `assertEntitled` via CP snapshot; `GET /internal/v1/subscription/snapshot` accepts `SATELLITE_EVENT_SERVICE_TOKEN` as well as the control-plane token. Sync runtime-config `activeModules` is cache when CP is unreachable. Spot-check: retail + CRM `assert*Entitled` (enter tenant, then gate with that org). AC entitlement notes stay 🟡 (not Scaffold ✅).

**PlacementJob API (Waves 11–15):** Super-admin `POST/GET /v1/admin/orgs/:orgId/placement-jobs`, `POST /v1/admin/placement-jobs/:id/advance`. Host agent `GET /v1/placement-agent/jobs` + `scripts/era-placement-agent.mjs` (logs only; host applies). Direct SHARED↔ONPREM → status `REJECTED`. Slice export = metadata stub (`exportOrgSlice` / orch mirror). **Not** live dump/migrate. Live SHARED pool ops still open. ADR: [`docs/adr/deployment-topology.md`](adr/deployment-topology.md).

**Finance → Orchestrator credentials (canonical names):** prefer `CONTROL_PLANE_SERVICE_TOKEN`; accept alias `ORCHESTRATOR_INTERNAL_SERVICE_TOKEN` (same value). Base URL: kit runtime-config → `ORCHESTRATOR_INTERNAL_URL` / `CONTROL_PLANE_URL` / `ORCHESTRATOR_URL` bootstrap. Health `GET /api/health` reports booleans only (`controlPlane.*Configured`, `pii*Configured`) — never secret values. Industry satellites resolve deployment org via `satelliteOrganizationId()` (bind Sync), not module-level `process.env.ERA_SATELLITE_ORGANIZATION_ID`.

### All 13 ingress event types — worker status

Validated on orchestrator ingress by `isSatelliteEvent()` in [`packages/era-contracts/src/events/satellite-event.ts`](../packages/era-contracts/src/events/satellite-event.ts). Finance routes each `type` in `SatelliteEventDispatchService`.

| Type | Satellite | Finance worker | Result |
|------|-----------|----------------|--------|
| `SATELLITE_HOTEL_RESERVATION_COMPLETED` | era-hotel-pms | `handleHotelReservation` | GL + draft invoice |
| `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` | era-hotel-pms | `handleHotelNightAudit` | Multi-line NAS journal from `revenueLines` + GL map |

**Hotel revenue split (room vs add-on):** PMS folio charges carry a `RevenueCode` (`ROOM`, `FOOD`, `MEDICAL`, …). The dynamic pricing engine (`quoteStay` in `era-hotel-pms`) emits quotes with separate **Room Revenue** and **Add-on Revenue** lines so each posts to the correct code. Night audit aggregates charges by `revenueCodeId`, enriches each line with `glAccountCode` (e.g. ROOM→601, FOOD→602), and sends `revenueLines[]` on `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` — enabling Finance/Orchestrator to route food revenue to the F&B org/satellite without merging it into accommodation revenue. See ADR [hotel-dynamic-rate-plans.md](./adr/hotel-dynamic-rate-plans.md).

**Elektraweb live bridge (Nafta dual-run):** temporary browser extension mirrors guests/reservations/open folio into `era-hotel-pms` while FO SoT remains Elektraweb. Ingest must emit the same hotel→clinic lifecycle events as native check-in (`SATELLITE_HOTEL_GUEST_CHECKED_IN` / `OUT`, `ROOM_CHANGED`, `SANATORIUM_BOOKING_CREATED`, `STAY_PRODUCT_CHANGED`) — not Prisma-only upsert. During dual-run do **not** emit `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` from ERA for mirrored stays. Extra SPA tickets stay in Elektraweb until hotel hour X (charge at **issue ticket**, not `COMPLETED`; walk-in extras → house folio `TIBB AMBULATOR FOLIO`, not Cash Office). **SaaS Wave 1:** property ids and dual-run flags are per org (Super-Admin `ElektrawebBridgePolicy` / `ClinicCutoverPolicy` + Sync); ingest/outbox org from JWT/body — [saas-request-tenant-and-vendor-bridges.md](./adr/saas-request-tenant-and-vendor-bridges.md). Docs: [inbound ADR](./adr/hotel-elektraweb-live-bridge.md) · [reverse extras](./adr/hotel-elektraweb-reverse-folio-post.md) · [ops guide](../era-hotel-pms/doc/ELEKTRAWEB-LIVE-BRIDGE.md).
| `SATELLITE_HOTEL_INVOICE_ISSUED` | era-hotel-pms | `handleHotelInvoiceIssued` | Draft sales invoice in Finance |
| `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT` | era-hotel-pms | `handleHotelCityLedgerSnapshot` | Agency city-ledger snapshot persisted (`AgencyCityLedgerSnapshot`); read on Finance counterparty |
| `SATELLITE_HOTEL_STAY_PRODUCT_CHANGED` | era-hotel-pms | skip (clinic lifecycle) | Fan-out to clinic remaining replan; payload: `globalPersonId`, `roomNumber`, stay dates, `newProgramCode`; Finance no-op |
| `SATELLITE_RETAIL_SALE_COMPLETED` | era-retail-pos | `handleRetailSale` | GL + draft invoice |
| `SATELLITE_RETAIL_SHIFT_CLOSED` | era-retail-pos | `handleRetailShiftClosed` | Cash recon log (meta only) |
| `SATELLITE_FB_SALE_COMPLETED` | era-fnb-pos | `handleFbSale` | GL journal (LOCAL_CASHIER only; not room-charge/hub) |
| `SATELLITE_FB_SHIFT_CLOSED` | era-fnb-pos | `handleFbShiftClosed` | Cash recon log (meta only) |
| `SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED` | era-fnb-pos | `handleFbStockConsumption` | WIP/COGS journal |
| `SATELLITE_LOGISTICS_TRIP_COMPLETED` | era-logistics | `handleLogisticsTrip` | GL posting |
| `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED` | era-construction | `handleConstructionAct` | GL + draft invoice |
| `SATELLITE_CRM_LEAD_CONVERTED` | era-crm | `handleCrmLead` | GL + draft invoice |
| `SATELLITE_CRM_VISIT_LOGGED` | era-crm | `handleCrmVisitLogged` | Activity log (meta only) |

**Shipped v3.0 (2026-07-02):** `SATELLITE_CRM_LEAD_CONVERTED` payload includes `partyKind`, `taxId`, `companyName`, contact fields, `activitySector`, `prospectType`; Finance `handleCrmLead` calls `findOrCreateByVoen` / `findOrCreateIndividualForCrm`. ADR [crm-lead-party-model-and-prospect-import.md](./adr/crm-lead-party-model-and-prospect-import.md).
| `SATELLITE_AUTO_WORK_ORDER_COMPLETED` | era-auto-service | `handleAutoSto` | GL + draft invoice |
| `SATELLITE_CLINIC_VISIT_COMPLETED` | era-clinic | `handleClinicVisit` | GL + draft invoice |
| `SATELLITE_CLINIC_PROCEDURE_COMPLETED` | era-clinic (auto-complete at `endsAt`, not at check-in) | procedure / folio dispatch | Tariff → folio/Accounting; **TTK lines → Finance inventory** (ADR [clinic-procedure-consumable-ttk.md](./adr/clinic-procedure-consumable-ttk.md)). `correlationId` = procedure order id. Empty `lines` = no stock. Retail HTTP write-off **retired**. |
| `SATELLITE_CLINIC_WARD_DAY_CHARGE` | era-clinic cron | `handleClinicWardDayCharge` | GL + draft invoice (inpatient day) |
| `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` | era-clinic | `handleClinicLabOrder` | GL + draft invoice |
| `SATELLITE_WHOLESALE_ORDER_CONFIRMED` | era-wholesale | `handleWholesaleOrder` | GL + draft invoice |

**Hotel outbound only** (custom ERP webhooks on `HotelProfile.integrationSettingsJson`; not in `isSatelliteEvent`): `SATELLITE_HOTEL_FOLIO_CHARGE_POSTED`, `SATELLITE_HOTEL_FOLIO_PAYMENT_RECEIVED`, `SATELLITE_HOTEL_FOLIO_CHARGE_VOIDED`, `SATELLITE_HOTEL_MASTER_DATA_SYNC`, `SATELLITE_HOTEL_PAYMENT_FISCALIZED`. See [HOSPITALITY_FINANCE_BOUNDARY.md](./HOSPITALITY_FINANCE_BOUNDARY.md).

Idempotency: table `satellite_events_processed` — replay same `correlationId` → skip (no duplicate postings).

Implementation: [`satellite-event-dispatch.service.ts`](../era-finance-core/apps/api/src/integration/satellite-event-dispatch.service.ts).

### Settlement hub HTTP bridge (Nafta unified Front Cash)

When org `settlementPolicy.settlementHub=HOTEL_FRONT_CASH` (see [unified-settlement-hub.md](./adr/unified-settlement-hub.md)):

| Direction | Endpoint | Auth |
|-----------|----------|------|
| fb-pos / clinic → hotel | `POST /api/settlement/pending` | `POS_BRIDGE_SECRET` / `x-pos-bridge-secret` |
| clinic → hotel (dual-run extras) | `POST /api/integrations/elektraweb-bridge/outbox` | same POS secret; widget drains with bridge JWT |
| hotel → fb-pos / clinic | `POST /api/integration/settlement-confirmed` | same secret |
| Front Cash UI | `GET /api/settlement/pending`, `POST …/[id]/pay`, `POST …/[id]/void` | session + `folio:payment` / `folio:void` |

Policy snapshot: orchestrator `GET /v1/subscription/me` → `settlementPolicy` (`deferWalkInToHub`, `pendingSettlementNaPolicy`). Client: `@era/satellite-kit` `resolveSettlementPolicy`, `shouldDeferWalkInToHub`.

Night audit on hotel-pms blocks when open pending count > 0 and `pendingSettlementNaPolicy=BLOCK` (default Nafta).

### Bank Core events (`industry_banking` / `era-bank-core`)

Implemented in `packages/era-contracts/src/events/banking.events.ts`:

| Type | Consumer |
|------|----------|
| `SATELLITE_BANK_GL_DAILY_SUMMARY` | Finance worker → summarized NAS journal (idempotent by business date) |
| `SATELLITE_BANK_ACCOUNT_OPENED` | Analytics (planned) |
| `SATELLITE_BANK_LOAN_DISBURSED` | Analytics (planned) |
| `SATELLITE_BANK_PAYMENT_POSTED` | Analytics (planned) |
| `SATELLITE_BANK_AML_ALERT_RAISED` | Compliance hub (engine publish on alert) |
| `SATELLITE_BANK_REG_REPORT_EXPORTED` | Analytics (engine publish on reg export) |
| `SATELLITE_BANK_DBO_PAYMENT_SIGNED` | Analytics (engine publish on DBO sign) |
| `SATELLITE_BANK_CARD_ISSUED` | Analytics (engine publish on issue) |
| `SATELLITE_BANK_CARD_TXN_DECLINED` | Platform notify (optional) |
| `SATELLITE_BANK_TREASURY_GAP_SNAPSHOT` | Analytics (engine publish on GAP run / EOD) |

**These are non-money events only** — notifications, analytics, reconciliation, and summarized corporate-journal handoff to finance. **Money never flows over the event bus**; all bank postings are ACID inside `bank-core` (ADR [era-bank-core.md](./adr/era-bank-core.md) D6). Inbound `STAFF_PROVISIONED` / `STAFF_DEACTIVATED` reuse the HR contract family. Spec: [era-bank-core/TZ.md](../era-bank-core/TZ.md) §9.

## Reference data (FX, calendar, HS)

Internal ERA apps consume **era-data-hub** via service token (`DATA_HUB_SERVICE_TOKEN`), not the satellite event bus.

| Data | Hub API | Primary consumers | Industry path |
|------|---------|-------------------|---------------|
| CBAR FX | `/registry/v1/fx/*` | finance-core, bank-core | Orchestrator `GET /platform/v1/catalog/fx/convert` via satellite-kit (`platformFxConvert`; legacy alias `financeFxPreview` until W2) |
| Production calendar | `/registry/v1/calendar/*` | finance HR, bank EOD | Orchestrator `GET /platform/v1/catalog/calendar/*` via satellite-kit; hotel auto-BAR bulk |
| HS tariffs | `/registry/v1/hs/*` | finance customs | Finance deep link only |
| VÖEN directory | `/registry/v1/companies/:voen` | finance voen-preview | Orchestrator `GET /platform/v1/catalog/companies/:voen` via satellite-kit |
| ICD-10 (WHO 2019) | — (not on data-hub) | clinic | Orchestrator `GET /platform/v1/catalog/icd10` **in-process** from shared generator (`platformIcd10Search`); clinic local `IcdCode` + optional sync. **Not** a data-hub proxy |

### Workforce policy (platform read — Wave 3)

| Endpoint | Auth | Response |
|----------|------|----------|
| `GET /platform/v1/workforce/policy?satelliteKey=` | Bearer `SATELLITE_EVENT_SERVICE_TOKEN` + `X-Organization-Id` | `{ hireMode: "cp_workforce" \| "disabled", workforceModuleActive, hrModuleActive, satelliteEntitled }` |

Client: `@era/satellite-kit` `fetchWorkforcePolicy`. Clinic SatAdmin: `GET /api/admin/workforce-policy` (session BFF).

ADR: [workforce-identity-and-hr-provisioning.md](./adr/workforce-identity-and-hr-provisioning.md). · [fx-rates-ecosystem.md](./adr/fx-rates-ecosystem.md) · [production-calendar-ecosystem.md](./adr/production-calendar-ecosystem.md) · Consumer guide: [era-data-hub/doc/DATA-HUB-CONSUMER.md](../era-data-hub/doc/DATA-HUB-CONSUMER.md).

Readiness snapshot: [READINESS_MATRIX.md](./READINESS_MATRIX.md).

## MDM natural-person identity (internal API)

**SoR:** Orchestrator `era_mdm` — `GlobalNaturalPerson` + `PersonIdentifier`. Person core also stores **`sex`** (`MALE` \| `FEMALE` \| `UNKNOWN`; no OTHER) and **`birthDate`**. Satellites store **`globalPersonId`** for identity links; identifier values in MDM. Hotel `Guest` retains documented **ops cache** (not plaintext FIN/passport after W4) including gender/DOB cache — [hotel-guest-pii-ops-cache.md](./adr/hotel-guest-pii-ops-cache.md).

**Auth:** `Authorization: Bearer` with `MDM_INTERNAL_SERVICE_TOKEN` (alias `SATELLITE_EVENT_SERVICE_TOKEN` in some apps).

**Canonical client:** `linkPersonIdentity` in `@era/satellite-kit` — resolve-or-create (writes sex/DOB when provided). Pass `globalPersonId` to fill an existing person.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/internal/v1/mdm/health` | Liveness |
| POST | `/internal/v1/mdm/persons/lookup-by-fin` | Consent-aware read / prefill (includes sex + birthDate when granted) |
| POST | `/internal/v1/mdm/persons/resolve` | Find-or-create (FIN / passport / VNJ + fullName + optional sex/birthDate); `globalPersonId` updates that row |
| GET | `/internal/v1/mdm/persons/:id/ops-profile` | Masked identifiers + sex + birthDate |
| POST | `/internal/v1/mdm/persons/merge` | Foreigner → citizen (explicit workflow) |
| POST | `/internal/v1/mdm/organizations/register` | VÖEN → `GlobalLegalEntity` |

**Super-admin MDM (JWT + SuperAdminGuard, not service token):**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/admin/mdm/persons` | Paginated directory (`fin`, `fullName`, `phone`, `birthDate`, `includeMerged`); decrypts name for operators |
| POST | `/v1/admin/mdm/persons/lookup-by-fin` | Exact FIN lookup |
| POST | `/v1/admin/mdm/persons/resolve` | Resolve/create |
| POST | `/v1/admin/mdm/persons/merge` | Merge duplicates |
| GET | `/v1/admin/mdm/persons/:id/identifiers` | Identifier rows |

**Clinic cutover `#21` glue (hotel stay → MDM person):** clinic wizard calls hotel `GET /api/internal/v1/stays/by-external-ref?externalRef=&organizationId=` (Bearer `SATELLITE_EVENT_SERVICE_TOKEN`) then `linkPersonIdentity` with that `globalPersonId` so re-import does not mint a second person. Import hotel guests/reservations before clinic patients.

### Holdings (S2S)

**Auth:** `Authorization: Bearer` + optional `x-service-token` (`ORCHESTRATOR_INTERNAL_SERVICE_TOKEN` / `SATELLITE_EVENT_SERVICE_TOKEN`).

User JWT composition API: `v1/holdings/*` (create, attach org, members). Web: Orchestrator `/holdings`. ADR: [holdings-control-plane.md](./adr/holdings-control-plane.md).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/internal/v1/holdings?userId=` | Holdings where user may view consolidated reports |
| GET | `/internal/v1/holdings/:id?userId=` | Composition + `canViewReports` for Finance consolidation |

**Finance consumer:** `GET /api/holdings`, reporting under `/api/holdings/:id/*` — live-lookup CP, no local holding SoT.

**MDM satellite proxies:** `POST /api/mdm/person-lookup` (hotel, clinic), `POST /api/mdm/person-merge` (SatAdmin).

**HR events:** `STAFF_PROVISIONED` payload includes `globalPersonId` when Finance employee is MDM-linked ([workforce-identity ADR](./adr/workforce-identity-and-hr-provisioning.md)).

**CP workforce absence events (Plan A):** Orchestrator → `era-satellite-events` → Finance worker when `hr_full`:

| Event | Purpose |
|-------|---------|
| `WORKFORCE_ABSENCE_APPROVED` | Upsert Finance `Absence` mirror (`cpAbsenceId`) |
| `WORKFORCE_ABSENCE_UPDATED` | Update mirror dates/kind |
| `WORKFORCE_ABSENCE_CANCELLED` | Soft-delete mirror + unlock timesheet cells |
| `WORKFORCE_VACATION_PLAN_APPROVED` | Annual vacation plan approved (CP master). Finance mirror **HEADLESS** for now (event published; no local table/consumer yet) |
| `WORKFORCE_PERSONNEL_ORDER_ISSUED` | (audit/log in CP; optional future satellite event) Printable kadr order issued — see ADR cp-personnel-orders |
| `WORKFORCE_STAFF_SCHEDULE_APPROVED` | (audit in CP) Approved ştat cədvəli revision snapshot |

Absence `kind` (TK AZ set): `VACATION` (əmək məzuniyyəti) → Finance `LABOR_LEAVE`, `SICK` → `SICK_LEAVE`, `UNPAID` → `UNPAID_LEAVE`, `SOCIAL_LEAVE` (maternity) → `SOCIAL_LEAVE`, `EDUCATIONAL_LEAVE` → `EDUCATIONAL_LEAVE`, `ADMINISTRATIVE` → `UNPAID_LEAVE`. `BUSINESS_TRIP` (ezamiyyət) is an attendance record, not a payroll leave, so it is **not** mirrored to Finance (sync skips it).

Schema: `packages/era-contracts/src/events/workforce.events.ts`. ADR: [cp-workforce-absence-split.md](./adr/cp-workforce-absence-split.md).

**MDM HR profile (WS2):** `GET/PATCH /internal/v1/mdm/persons/:personId/hr-profile?organizationId=` (PersonAccessGrant). Ops-profile + batch include decrypted `hrProfile` when grant allows. Finance reads via `OrchestratorMdmClientService.getHrProfile` / `batchHrProfiles` — never persists blood/address/education/marital/stats/photo on `Employee`.

**STAFF_PROVISIONED / STAFF_DEACTIVATED (Plan C):** Publisher = **Orchestrator CP** (`WorkforceProvisionService`). Payload v2 requires `cpEmploymentId`; optional `financeEmployeeId` for payroll extension. `fullName` in payload is **T3 ops-cache display stamp only** (from MDM at provision); not authoritative — see [cp-workforce-pii-tiers.md](./adr/cp-workforce-pii-tiers.md). Schema: `packages/era-contracts/src/events/hr.events.ts`. ADR: [cp-workforce-role-templates-and-security-admin.md](./adr/cp-workforce-role-templates-and-security-admin.md).

Fan-out: `SatelliteEventsService` → queue `era-satellite-fanout` → `POST {baseUrl}/api/integration/staff-provision` with header `x-satellite-bridge-secret`. The path is session-public (`DEFAULT_PUBLIC_API_PREFIXES`); auth is the bridge secret, not a staff cookie. Endpoint resolution: `SatelliteEndpoint` row, else docker-internal env (`CLINIC_API_URL` / `HOTEL_PMS_API_URL` / `FNB_POS_API_URL`). Do **not** point those env vars at public `https://*.era-365.online` from the orchestrator container (Traefik loop). Shared secret: `SATELLITE_BRIDGE_SECRET` (clinic also accepts `CLINIC_BRIDGE_SECRET`). Handlers bind tenant via `enterRequestTenant(event.organizationId)` and stamp `organizationId` on local User (required on SHARED; Nafta DEDICATED also uses the event org). User `passwordHash` is kit **scrypt** (`hashPassword`) so `/login` works. F&B floor PIN on `StaffRoster.pinHash` stays SHA-256 (`hashStaffPin`) for `/api/labor/clock`. **Hotel + clinic** `staff-provision` **ensure** the mapped Role row (with hotel `ROLE_PERMISSIONS` JSON) when missing — do not require a prior full seed for CP hire/grant to succeed.

**Default PIN / password change:** CP emits `pin: "0000"` (no CP UI to set a password). Clinic ops change it after first login: profile menu → **Change password** (`/account/password`, `PATCH /api/auth/password`). SSO users (`sso:no-password`) cannot set a local password. Hotel admin can still reset via `/settings/users`; F&B web login uses the same scrypt hash as clinic (PIN clock is separate).

**Reprovision UI:** Workspace → Workforce → Employments → row **⋯** → Reprovision (confirm). Overflow is always visible; the action is disabled until the employment has at least one **active** satellite binding (grant Hotel/Clinic/F&B first). `GET /platform/v1/workforce/employments` and employment detail include those bindings. Creating a manual grant also calls the same `reprovision` internally.

**Clinic Excel cutover vs workforce (name match):** imported `Practitioner` rows have `cpEmploymentId` / `globalPersonId` null. Link order is `cpEmploymentId` → `globalPersonId` → **unique** name match among unlinked same `staffKind`. Unique means **exactly one** imported card looks like the MDM FIO (latinized tokens; e.g. `Rəna Kəngərli` ↔ `Kangarli Rana Kamil qizi`). Zero matches → create a new practitioner (imported card stays unlinked). Two or more matches → do **not** guess; create a new card rather than attach the login to the wrong doctor.

**Who consumes STAFF_PROVISIONED today**

| Satellite | Local staff login from CP hire/grant | Handler |
|-----------|--------------------------------------|---------|
| Clinic | Yes (`User` + `Practitioner`) | `era-clinic` `/api/integration/staff-provision` |
| Hotel PMS | Yes (`User`, role `Receptionist` for CP `RECEPTION`) | `era-hotel-pms` same path. Bridge: extension Settings uses this login. |
| F&B POS | Yes (`User` + `StaffRoster` PIN) | `era-fnb-pos` same path |
| Retail, logistics, construction, CRM, auto, wholesale | **Not yet.** Owner/manager use SSO from the launcher. Security Admin grant is recorded in CP but **no satellite User is created**. Floor staff of those verticals do not get `emp-*` / `0000` until a handler + `FANOUT_URL_ENV` entry exists. | none |
| Bank | Different bus: bank-core `/internal/v1/staff-provisioning` (finance HR family), not this industry fan-out. | bank-core |

Do not treat a grant to `industry_retail` (etc.) as a working POS login. Track the gap here so a later wave can add handlers without rediscovering it.

**CP workforce org events (Plan B):** Orchestrator → `era-satellite-events` → Finance worker when `hr_full`:

| Event | Purpose |
|-------|---------|
| `WORKFORCE_ORG_UNIT_UPSERTED` | Upsert Finance `Department` CostCenter mirror (`cpOrgUnitId`) |
| `WORKFORCE_ORG_UNIT_ARCHIVED` | Soft-delete Department mirror |
| `WORKFORCE_POSITION_UPSERTED` | Upsert Finance `JobPosition` mirror (`cpPositionId`, slots) |
| `WORKFORCE_EMPLOYMENT_TRANSFERRED` | Update Finance `Employee.positionId` when `financeEmployeeId` linked |

**CP workforce timesheet events (Plan F):**

| Event | Direction | Purpose |
|-------|-----------|---------|
| `WORKFORCE_TIMESHEET_BATCH_IMPORTED` | construction → orchestrator | Upsert cells on CP month `WorkforceTimesheet` |
| `WORKFORCE_TIMESHEET_APPROVED` | orchestrator → Finance (`hr_full`) | Mirror hours + optional `rows[].type`. Finance mutations 409 `TIMESHEET_MASTER_IS_CP` when `platform_workforce`; Finance UI link-only (no local edit). CP cherry-pick approve retired (410). |

ADR: [workforce-timesheet-construction-bridge.md](./adr/workforce-timesheet-construction-bridge.md).

ADR: [cp-workforce-org-units.md](./adr/cp-workforce-org-units.md).

ADR: [era-mdm-natural-person-identity.md](./adr/era-mdm-natural-person-identity.md) · [mdm-satellite-integration-contract.md](./adr/mdm-satellite-integration-contract.md).
