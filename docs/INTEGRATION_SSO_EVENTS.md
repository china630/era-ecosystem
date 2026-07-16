# Control plane SSO & satellite event bus

## Public hub (Orchestrator web)

Marketing and onboarding routes live on **Orchestrator web** (`NEXT_PUBLIC_ORCH_WEB_URL`, default `:3000`): `/login`, `/register`, `/register-org`, `/pricing`, `/help`, `/terms`, `/partner`. Finance and satellites link out via `orchPublicHref()`; Finance `/pricing` and `/register*` redirect to Orch. Canonical FAQ: Orch `/help`. See [ECOSYSTEM_URLS.md](./ECOSYSTEM_URLS.md).

## SSO (Epic A — Phase A complete)

- **Issuer:** `era-orchestrator` (`POST /auth/login`, `POST /auth/token/refresh`, `POST /auth/sso/exchange`)
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

JWKS endpoint: `era-orchestrator/apps/api/src/auth/well-known.controller.ts`. DELIVERY checkbox: [DELIVERY-ORCHESTRATOR.md](../era-orchestrator/doc/DELIVERY-ORCHESTRATOR.md) CP2.
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

**Hotel revenue split (room vs add-on):** PMS folio charges carry a `RevenueCode` (`ROOM`, `FOOD`, `MEDICAL`, …). The dynamic pricing engine (`quoteStay` in `era-hotel-pms`) emits quotes with separate **Room Revenue** and **Add-on Revenue** lines so each posts to the correct code. Night audit aggregates charges by `revenueCodeId`, enriches each line with `glAccountCode` (e.g. ROOM→601, FOOD→602), and sends `revenueLines[]` on `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` — enabling Finance/Orchestrator to route food revenue to the F&B org/satellite without merging it into accommodation revenue. See ADR [hotel-dynamic-rate-plans.md](./adr/hotel-dynamic-rate-plans.md).

**Elektraweb live bridge (Nafta dual-run, planned):** temporary browser extension mirrors guests/reservations/open folio into `era-hotel-pms` while FO SoT remains Elektraweb. Ingest must emit the same hotel→clinic lifecycle events as native check-in (`SATELLITE_HOTEL_GUEST_CHECKED_IN` / `OUT`, `ROOM_CHANGED`, `SANATORIUM_BOOKING_CREATED`) — not Prisma-only upsert. During dual-run do **not** emit `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` from ERA for mirrored stays. Docs: [ADR](./adr/hotel-elektraweb-live-bridge.md) · [ELEKTRAWEB-LIVE-BRIDGE.md](../era-hotel-pms/doc/ELEKTRAWEB-LIVE-BRIDGE.md).
| `SATELLITE_HOTEL_INVOICE_ISSUED` | era-hotel-pms | `handleHotelInvoiceIssued` | Draft sales invoice in Finance |
| `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT` | era-hotel-pms | `handleHotelCityLedgerSnapshot` | Agency city-ledger snapshot persisted (`AgencyCityLedgerSnapshot`); read on Finance counterparty |
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

### Workforce policy (platform read — Wave 3)

| Endpoint | Auth | Response |
|----------|------|----------|
| `GET /platform/v1/workforce/policy?satelliteKey=` | Bearer `SATELLITE_EVENT_SERVICE_TOKEN` + `X-Organization-Id` | `{ hireMode: "cp_workforce" \| "disabled", workforceModuleActive, hrModuleActive, satelliteEntitled }` |

Client: `@era/satellite-kit` `fetchWorkforcePolicy`. Clinic SatAdmin: `GET /api/admin/workforce-policy` (session BFF).

ADR: [workforce-identity-and-hr-provisioning.md](./adr/workforce-identity-and-hr-provisioning.md). · [fx-rates-ecosystem.md](./adr/fx-rates-ecosystem.md) · [production-calendar-ecosystem.md](./adr/production-calendar-ecosystem.md) · Consumer guide: [era-data-hub/doc/DATA-HUB-CONSUMER.md](../era-data-hub/doc/DATA-HUB-CONSUMER.md).

Readiness snapshot: [READINESS_MATRIX.md](./READINESS_MATRIX.md).

## MDM natural-person identity (internal API)

**SoR:** Orchestrator `era_mdm` — `GlobalNaturalPerson` + `PersonIdentifier`. Satellites store **`globalPersonId`** for identity links; identifier values in MDM. Hotel `Guest` retains documented **ops cache** (not plaintext FIN/passport after W4) — [hotel-guest-pii-ops-cache.md](./adr/hotel-guest-pii-ops-cache.md).

**Auth:** `Authorization: Bearer` with `MDM_INTERNAL_SERVICE_TOKEN` (alias `SATELLITE_EVENT_SERVICE_TOKEN` in some apps).

**Canonical client:** `linkPersonIdentity` in `@era/satellite-kit` — lookup FIN → else `resolvePersonIdentity`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/internal/v1/mdm/health` | Liveness |
| POST | `/internal/v1/mdm/persons/lookup-by-fin` | Consent-aware read / prefill |
| POST | `/internal/v1/mdm/persons/resolve` | Find-or-create (FIN / passport / VNJ + fullName) |
| POST | `/internal/v1/mdm/persons/merge` | Foreigner → citizen (explicit workflow) |
| POST | `/internal/v1/mdm/organizations/register` | VÖEN → `GlobalLegalEntity` |

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

Schema: `packages/era-contracts/src/events/workforce.events.ts`. ADR: [cp-workforce-absence-split.md](./adr/cp-workforce-absence-split.md).

**MDM HR profile (WS2):** `GET/PATCH /internal/v1/mdm/persons/:personId/hr-profile?organizationId=` (PersonAccessGrant). Ops-profile + batch include decrypted `hrProfile` when grant allows. Finance reads via `OrchestratorMdmClientService.getHrProfile` / `batchHrProfiles` — never persists blood/address/education/marital/stats/photo on `Employee`.

**STAFF_PROVISIONED / STAFF_DEACTIVATED (Plan C):** Publisher = **Orchestrator CP** (`WorkforceProvisionService`). Payload v2 requires `cpEmploymentId`; optional `financeEmployeeId` for payroll extension. `fullName` in payload is **T3 ops-cache display stamp only** (from MDM at provision); not authoritative — see [cp-workforce-pii-tiers.md](./adr/cp-workforce-pii-tiers.md). Schema: `packages/era-contracts/src/events/hr.events.ts`. ADR: [cp-workforce-role-templates-and-security-admin.md](./adr/cp-workforce-role-templates-and-security-admin.md).

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
| `WORKFORCE_TIMESHEET_BATCH_IMPORTED` | construction → orchestrator | CP DRAFT `WorkforceTimesheetEntry` rows |
| `WORKFORCE_TIMESHEET_APPROVED` | orchestrator → Finance (`hr_full`) | Mirror WORK hours to payroll timesheet |

ADR: [workforce-timesheet-construction-bridge.md](./adr/workforce-timesheet-construction-bridge.md).

ADR: [cp-workforce-org-units.md](./adr/cp-workforce-org-units.md).

ADR: [era-mdm-natural-person-identity.md](./adr/era-mdm-natural-person-identity.md) · [mdm-satellite-integration-contract.md](./adr/mdm-satellite-integration-contract.md).
