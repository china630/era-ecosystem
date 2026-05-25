# ERA 365 Orchestrator — PRD

> Control plane: identity, RBAC, SSO, entitlements, satellite event ingress.

| Param | Value |
|-------|-------|
| Port | 4100 |
| Consumers | era-finance-core, industry satellites |

## §1 Vision

Single source of truth for login, organization membership, **OWNER** / `isOwner`, SSO exchange, billing entitlements validation, satellite event gateway.

## §2 Modules

| ID | Module | Status |
|----|--------|--------|
| M1 | Auth (login, refresh, SSO) | **MVP** |
| M2 | Membership API | **MVP** |
| M3 | Entitlements validate | **MVP** |
| M4 | Satellite events ingress | **MVP** |
| M5 | Access request / transfer ownership | **PLANNED** |
| M6 | Ownership dispute | **PLANNED** |

## §3 JWT claims

`organizationId`, `role`, `roles[]`, `isOwner`, `isSuperAdmin` — see [INTEGRATION_SSO_EVENTS.md](../docs/INTEGRATION_SSO_EVENTS.md).

## §4 Changelog

| Date | Note |
|------|------|
| 2026-05-24 | PRD v1.0 — Sprint S1 P0 |
