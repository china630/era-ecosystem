# DELIVERY-CONSTRUCTION

PRD: [../PRD.md](../PRD.md)

## C0 (done)

- [x] PRD v1.0, scaffold, SSO, `/projects` placeholder

## C1 — MVP

- [x] Project + BOQ stub
- [x] Progress act approve → event E2E

## C2

- [x] Material requisition (C-02) — `GET/POST /api/material-requisitions`
- [x] Plan vs actual (C-04) — `GET /api/projects/[id]/plan-vs-actual`, `/projects/[id]` UI

Platform add-ons (booking, notifications, portal, payments): `src/integration/control-plane-platform.client.ts` → `CONTROL_PLANE_URL` (era-365-orchestrator).
