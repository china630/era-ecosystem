# DELIVERY-ORCHESTRATOR

PRD: [../PRD.md](../PRD.md)

## CP0 — Scaffold (done)

- [x] Auth login, SSO exchange, entitlements, satellite events

## CP1 — P0 RBAC (Sprint 1)

- [x] JWT claims: `roles[]`, `isOwner`
- [x] Refresh token issued on login
- [x] `GET /memberships`, `POST /auth/switch-organization`
- [x] Organization model (`ownerId`) in control-plane schema
- [x] Access request API (`POST /auth/join-org`, `GET/POST /team/access-requests/*`)
- [x] Transfer ownership API (`POST /organizations/transfer-ownership`; Finance proxies when `ERA_CONTROL_PLANE_RBAC_PROXY=true`)
- [x] Ownership dispute API (`DisputeModule`: admin + public counter-claim routes)

## CP2 — Hardening

- [ ] RS256 + JWKS
- [ ] Permission resolution into JWT `permissions[]`

## CP-MDM — era-mdm Phase 1 (Wave 3 Nafta HN-P)

- [x] Separate DB `era_mdm` — package `@era365/mdm-database`
- [x] Models: `GlobalNaturalPerson`, `GlobalLegalEntity`, consent stubs (`PersonAccessRequest`, `PersonAccessGrant`, `PersonAccessLog`)
- [x] `MdmModule` — `GET /internal/v1/mdm/health`, `POST .../organizations/register`, `POST .../persons`, `POST .../access-requests`
- [x] PII encrypt + blind index (see [doc/adr/era-mdm-phase1.md](adr/era-mdm-phase1.md))
- [ ] Finance registration cutover from `auth.service.ts` (documented deferral in ADR §5)

## CP-BILLING — Platform billing (single migration)

**One plan, one cutover** — full inventory: [CP-BILLING-MIGRATION.md](../../docs/CP-BILLING-MIGRATION.md)

- [ ] CP-BILLING-1 … CP-BILLING-9 (see migration doc checklist)

**Not in CP-BILLING:** Platform add-ons (Notifications, Booking, …) — after billing SoT is on orchestrator. See [PLATFORM_ADDONS.md](../../docs/PLATFORM_ADDONS.md).
