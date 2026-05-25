# DELIVERY-ORCHESTRATOR

PRD: [../PRD.md](../PRD.md)

## CP0 — Scaffold (done)

- [x] Auth login, SSO exchange, entitlements, satellite events

## CP1 — P0 RBAC (Sprint 1)

- [x] JWT claims: `roles[]`, `isOwner`
- [x] Refresh token issued on login
- [x] `GET /memberships`, `POST /auth/switch-organization`
- [x] Organization model (`ownerId`) in control-plane schema
- [ ] Access request API
- [ ] Transfer ownership API (migrate from Finance)
- [ ] Ownership dispute API

## CP2 — Hardening

- [ ] RS256 + JWKS
- [ ] Permission resolution into JWT `permissions[]`
