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
- [x] PII encrypt + blind index (see [doc/adr/era-mdm-phase1.md](adr/era-mdm-phase1.md))
- [ ] Finance registration cutover from `auth.service.ts` (documented deferral in ADR §5)

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

## Quartet product (SP6)

- [x] Track A smoke — `scripts/quartet-smoke.mjs`, CI `quartet-smoke` job
- [x] Track B — entitlement source of truth via `getSubscriptionMe`; quota `internal/v1/quota` UAT Wave F
- [x] Notifications Live on staging — provider env (`SMS_PROVIDER`, email transport) documented in UAT-SMOKE-PLATFORM
