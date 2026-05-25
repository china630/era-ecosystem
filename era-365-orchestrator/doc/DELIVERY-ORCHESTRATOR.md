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
