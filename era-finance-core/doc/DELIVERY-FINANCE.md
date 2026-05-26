# DELIVERY-FINANCE

Finance core — quartet product path (Track C).

## FIN-CP — Control plane auth

- [x] `ERA_AUTH_MODE=control-plane` — CP guards, billing summary smoke
- [x] Industry launcher — Hot/FB deep links + SSO (`industry-modules.ts`)
- [x] Memberships **Live** — `GET /api/auth/me` + `POST /api/auth/switch` proxy to Orch when `ERA_AUTH_MODE=control-plane`
- [x] RBAC join/access/transfer — proxy to Orch (`ERA_CONTROL_PLANE_RBAC_PROXY`)

## FIN-E8 — Satellite ingress

- [x] 13 legacy `@era/contracts` ingress types → worker
- [x] **FB-10** `SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED` → COGS/WIP journal (`satellite-event-dispatch.service.ts`)
- [ ] Finance registration → MDM full cutover (Orch ADR §5 — not quartet blocker)

## Quartet smoke

- [x] `GET /api/health` — `scripts/quartet-smoke.mjs`
- [x] CP login → `/cp` billing — [SETUP_AND_RUN.md](../../docs/SETUP_AND_RUN.md)

## Track A

- [x] Documented in [QUARTET_UAT.md](../../docs/QUARTET_UAT.md)
