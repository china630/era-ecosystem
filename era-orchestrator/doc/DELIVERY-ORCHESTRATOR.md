# DELIVERY-ORCHESTRATOR

PRD: [../PRD.md](../PRD.md)

## CP0 — Scaffold (done)

- [x] Auth login, SSO exchange, entitlements, satellite events

## CP1 — P0 RBAC (Sprint 1)

- [x] JWT claims: `roles[]`, `isOwner`
- [x] Refresh token issued on login
- [x] `GET /memberships`, `POST /auth/switch-organization` — **Live** ([UAT-SMOKE-RBAC.md](./UAT-SMOKE-RBAC.md))
- [x] Organization model (`ownerId`) in control-plane schema
- [x] Access request API (`POST /auth/join-org`, `GET/POST /team/access-requests/*`) — **Live** UAT
- [x] Transfer ownership API (`POST /organizations/transfer-ownership`; Finance proxies when `ERA_CONTROL_PLANE_RBAC_PROXY=true`)
- [x] Ownership dispute API (`DisputeModule`: admin + public counter-claim routes)
- [x] `internal/v1/entitlements/validate` — staging smoke in UAT-SMOKE-RBAC

## CP2 — Hardening (Wave E-C)

- [x] JWT `permissions[]` from role map (`apps/api/src/auth/role-permissions.ts`)
- [x] RS256 staging doc + JWKS — [INTEGRATION_SSO_EVENTS.md](../../docs/INTEGRATION_SSO_EVENTS.md) § CP2 RS256; HS256 default local
- [x] RS256 dual-mode (`ERA_JWT_SIGNING_MODE`, JWKS, Finance `ERA_JWT_JWKS_URL`) — `scripts/jwks-auth-smoke.mjs`
- [x] Finance handoff one-time ticket — `POST /auth/finance-handoff`
- [x] `GET /platform/booking/v1/slots?resourceKey=` — list smoke (Wave E-B)
- [x] Notifications pack **Live** — outbox idempotency + channel dispatch (provider env-gated)

## CP-MDM — era-mdm Phase 1 (Wave 3 Nafta HN-P)

- [x] Separate DB `era_mdm` — package `@era365/mdm-database`
- [x] Models: `GlobalNaturalPerson`, `GlobalLegalEntity`, consent stubs (`PersonAccessRequest`, `PersonAccessGrant`, `PersonAccessLog`)
- [x] `MdmModule` — `GET /internal/v1/mdm/health`, `POST .../organizations/register`, `POST .../persons`, `POST .../access-requests`
- [x] Super-admin write — `POST /v1/admin/mdm/persons/lookup-by-fin|resolve|merge`, `GET .../persons/:id/identifiers`; UI `/super-admin/mdm/persons`
- [x] PII encrypt + blind index (see [doc/adr/era-mdm-phase1.md](adr/era-mdm-phase1.md))
- [x] Finance registration cutover — canonical `POST /auth/register-organization` + MDM; Finance `ERA_MDM_REGISTRATION_CUTOVER=true` redirects

## CP-MDM-P2 — Citizen consent portal (R1-N02)

- [x] `POST /portal/v1/mdm/access/session` — guest QR → consent session
- [x] `GET /portal/v1/mdm/access/requests` + `POST .../decide` — grant/deny + `PersonAccessGrant`
- [x] UI `/portal/person-access` — en/az/ru; BFF `/api/portal/mdm/*`
- [x] Auto pending `PersonAccessRequest` on masked FIN lookup without grant

## CP-BILLING — Platform billing (single migration)

**One plan, one cutover** — full inventory: [CP-BILLING-MIGRATION.md](../../docs/CP-BILLING-MIGRATION.md)

- [x] CP-BILLING-1 … CP-BILLING-10 (see migration doc checklist)

## CP-PLATFORM — Notifications + add-ons (post-billing)

- [x] CP-B2 Notifications Pack — outbox, worker, entitlement guard, webhooks
- [x] CP-B3–B5 MVP — booking, portal, payment links (orchestrator `/platform/*`)
- [x] CP-BILLING Live smoke — [UAT-SMOKE-PLATFORM.md](./UAT-SMOKE-PLATFORM.md) § CP-BILLING cutover
- [x] CP-B6–B8 — loyalty, domains, delivery (MVP persistence: `platform_promotions`, `platform_custom_domains`, `platform_shipments`)
- [x] UAT smoke CP-B6–B8 + hotel spa — [UAT-SMOKE-PLATFORM.md](./UAT-SMOKE-PLATFORM.md)
- [x] Wave D — `getSubscriptionMe` client in `@era/satellite-kit`; satellites billing-snapshot routes documented in [READINESS_MATRIX.md](../../docs/READINESS_MATRIX.md) §2.2 / §4
- [x] Wave F §4 — `readiness-coverage.mjs` host/consumer/N/A; commerce loyalty/domains/delivery hooks on satellites

**DB (Wave C):** `platform_promotions`, `platform_custom_domains`, `platform_shipments` — `prisma db push` or equivalent migration on shared Postgres.

**Not in CP-BILLING:** Platform add-ons catalog — [PLATFORM_ADDONS.md](../../docs/PLATFORM_ADDONS.md).

## CP-REFERENCE-DATA — ERA Data Hub API keys (Pass 2)

- [x] `platform_reference_data` in `pricing-module-seed`
- [x] `POST /platform/reference-data/v1/validate-key` (service token; `@Public`)
- [x] Entitlement guard `assertPlatformModule(org, platform_reference_data)` (skippable via `REFERENCE_DATA_SKIP_ENTITLEMENT=1` for dev)
- [x] Meter stub — `PlatformAuditLog` action `validate_api_key`
- [x] UAT — [UAT-SMOKE-PLATFORM.md](./UAT-SMOKE-PLATFORM.md) § CP-REFERENCE-DATA

Env: `REFERENCE_DATA_VALID_API_KEYS`, `REFERENCE_DATA_DEFAULT_ORG_ID`. Consumer doc: [DATA-HUB-CONSUMER.md](../../era-data-hub/doc/DATA-HUB-CONSUMER.md).

## CP-CATALOG-GATEWAY — Platform integration gateway (Wave 2)

Industry satellites read calendar, FX convert, VÖEN directory via orchestrator (not data-hub / finance directly).

- [x] `GET /platform/v1/catalog/calendar/*` — proxy to data-hub
- [x] `GET /platform/v1/catalog/fx/convert`
- [x] `GET /platform/v1/catalog/companies/:voen`
- [x] Auth: `SATELLITE_EVENT_SERVICE_TOKEN` + `X-Organization-Id`; entitlement `platform_reference_data`
- [x] `@era/satellite-kit` `platform-catalog.client.ts` + calendar/finance handoff delegates

Env (orchestrator): `ERA_DATA_HUB_URL`, `DATA_HUB_SERVICE_TOKEN`. Industry: `ORCHESTRATOR_URL`, `SATELLITE_EVENT_SERVICE_TOKEN`, `ERA_SATELLITE_ORGANIZATION_ID`.

## Quartet product (SP6)

- [x] Track A smoke — `scripts/quartet-smoke.mjs`, CI `quartet-smoke` job
- [x] Track B — entitlement source of truth via `getSubscriptionMe`; quota `internal/v1/quota` UAT Wave F
- [x] Notifications Live on staging — provider env (`SMS_PROVIDER`, email transport) documented in UAT-SMOKE-PLATFORM

## CP-WF-ABS — Workforce absence workflow (Plan A)

- [x] `WorkforceEmployment` + `WorkforceAbsence` schema + audit log
- [x] `GET/POST /platform/v1/workforce/employments` — MDM `globalPersonId` hire
- [x] `GET/POST/PATCH /platform/v1/workforce/absences/*` — submit/approve/reject/cancel + overlap guard
- [x] `WORKFORCE_ABSENCE_*` → `era-satellite-events` → Finance mirror (when `hr_full`)
- [x] Web `/workspace/workforce/employments`, `/workspace/workforce/absences` (+ new, detail) + BFF + i18n en/az/ru
- [x] UAT — [COVERAGE_MATRIX.md](../../docs/COVERAGE_MATRIX.md) `CP-WF-ABS-01`

## CP-WF-ORG — Workforce org structure (Plan B)

- [x] `WorkforceScope`, `OrgUnit`, `OrgUnitCommercialLink`, `WorkforcePosition` schema
- [x] `GET/POST /platform/v1/workforce/scope/*`, `/org-units/*`, `/positions/*`, employment `transfer`
- [x] `WORKFORCE_ORG_UNIT_*`, `WORKFORCE_POSITION_*`, `WORKFORCE_EMPLOYMENT_TRANSFERRED` events
- [x] Web `/workspace/workforce/org-structure`, `/positions`; employments hire requires orgUnit + position + i18n en/az/ru
- [x] UAT — [COVERAGE_MATRIX.md](../../docs/COVERAGE_MATRIX.md) `CP-WF-ORG-01`, `CP-WF-POS-01`

## CP-WF-SEC — Role templates, hire, Security Admin (Plan C)

- [x] `SatelliteRoleTemplate`, `WorkforceRoleBinding`, `ManualGrant`, `WorkforceSeatAllocation` schema
- [x] `POST /platform/v1/workforce/employments/hire`, terminate, reprovision; role-templates; manual-grants; security overview
- [x] `STAFF_PROVISIONED` v2 (`cpEmploymentId`) published from CP; `WorkforceAssignment` registry upgrade
- [x] Web `/workspace/workforce/security`; employments hire wizard + satellite checkboxes + i18n en

## CP-WF-HUB — v3 Workforce clean cutover (Plan E)

- [x] `platform_workforce` SKU + trial bundle; policy `cp_workforce` only
- [x] Legacy removal: no `finance_hr`/`local_master`; Finance STAFF publisher removed; clinic POST practitioners 403
- [x] `tools/bootstrap-local.mjs --workforce-seed`; `scripts/v3-workforce-smoke.mjs`; `scripts/nafta-onboard-departments.mjs`
- [x] Audit v3 rules (`WORKFORCE_DUAL_PATH`, `WORKFORCE_V3_PUBLISHER`); baseline empty
- [x] ADR [cp-core-workforce-hub.md](../docs/adr/cp-core-workforce-hub.md); runbook [v3-workforce-cutover.md](../docs/runbooks/v3-workforce-cutover.md)

## CP-WF-F — Workforce extensions (Plan F)

- [x] F6: `platform_workforce` SKU + workspace tile; strict entitlement guard
- [x] F4: `WorkforceSeatService` + `POST /internal/v1/licensing/seats/check` + Security seats widget
- [x] F5: `WorkforceAuditLog` correlation fields + `/workspace/workforce/security/audit` + satellite-kit stamp
- [x] F1: Export API + `/workspace/workforce/export` UI; Nafta §7
- [x] F3: ƏMAS boundary ADR + `getEmasPrefill` cpEmploymentId + absence mirror
- [x] F2: `WORKFORCE_TIMESHEET_*` events + construction import publish + Finance consumer
- [x] ADRs F1–F5; COVERAGE `CP-WF-EXP-01`, `CP-WF-SEAT-01`, `CN-CAL-02`

## CP-WF-PII — Workforce PII tiers (Plan D)

- [x] MDM `POST /internal/v1/mdm/persons/ops-profile/batch` + `workforce-resolve`; `WORKFORCE_OPS_PROFILE_BATCH` access log
- [x] Web BFF `/api/platform/mdm/workforce/*`; `@era/satellite-kit` `workforce-person.client.ts`
- [x] CP employments/absences lists — MDM batch display + masked FIN; Finance Employee payroll-only + MDM read-through
- [x] Audit `WORKFORCE_PII_LEAK` + ADR [cp-workforce-pii-tiers.md](../docs/adr/cp-workforce-pii-tiers.md)
- [x] UAT — [COVERAGE_MATRIX.md](../../docs/COVERAGE_MATRIX.md) `CP-WF-SEC-01`, `CP-WF-HIRE-01`, `CLI-WF-01`
