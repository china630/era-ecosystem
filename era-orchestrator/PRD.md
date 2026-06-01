# ERA 365 Orchestrator — PRD

> Control plane: identity, RBAC, SSO, entitlements, satellite event ingress.

| Param | Value |
|-------|-------|
| Port | 4100 |
| Consumers | era-finance-core, industry satellites |

## §1 Vision

Single source of truth for login, organization membership, **OWNER** / `isOwner`, SSO exchange, **billing & entitlements**, **platform add-ons**, satellite event gateway.

**Target architecture:** [docs/CONTROL_PLANE_ARCHITECTURE.md](../docs/CONTROL_PLANE_ARCHITECTURE.md) · **Platform add-ons:** [docs/PLATFORM_ADDONS.md](../docs/PLATFORM_ADDONS.md) · **ADR:** [doc/adr/control-plane-billing-migration.md](doc/adr/control-plane-billing-migration.md)

## §2 Modules

| ID | Module | Status |
|----|--------|--------|
| M1 | Auth (login, refresh, SSO) | **DONE** |
| M2 | Membership API | **DONE** |
| M3 | Entitlements validate | **DONE** |
| M4 | Satellite events ingress | **DONE** |
| M5 | Access request / transfer ownership | **DONE** (CP1) |
| M6 | Ownership dispute | **DONE** (CP1) |
| M7 | Billing & subscription SoT | **DONE** (CP-BILLING) |
| M8 | Platform add-ons (Notifications, Booking, …) | **Live** (CP-B2–B8) |
| M9 | Launcher web | **DONE** |

## §3 JWT claims

`organizationId`, `role`, `roles[]`, `isOwner`, `isSuperAdmin` — see [INTEGRATION_SSO_EVENTS.md](../docs/INTEGRATION_SSO_EVENTS.md).

## §4 Changelog

| Date | Note |
|------|------|
| 2026-05-24 | PRD v1.0 — Sprint S1 P0 |
| 2026-05-23 | v1.1 — Control plane billing & platform add-ons scope (docs/ADR) |
