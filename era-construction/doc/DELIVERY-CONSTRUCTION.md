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

## C3 — Platform add-ons (v1.0)

- [x] Notifications on progress act approve — `@era/satellite-kit`
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot`
- [x] Portal/pay on progress act; delivery on material requisition (MVP)
- [x] Booking — `createBookingSlot` site-visit on progress act approve (MVP)
- [x] Loyalty/domains on progress act approve

## Platform session (v1.0)

- [x] Platform session via SSO — `PlatformSessionBarServer`
- [x] Local operational RBAC unchanged; no local Orch RBAC API (N/A)

## Operations (v1.0)

- [x] Plan vs actual UI + cost hooks via progress acts
- [x] Platform commerce/booking on progress act

## Product modules (v1.0)

PRD M6–M12 · [MODULES_CATALOG](../../docs/MODULES_CATALOG.md)

- [x] M6: Field daily log API + mobile form
- [x] M7: Punch list / defect tracker
- [x] M9: Subcontractor claim stub

## Planned — v1.1

- [x] M8: Gantt / CPM scheduling
- [x] M10: Site equipment / machine hours
- [x] M11: CDE / drawing versions
- [x] M12: Labor timesheets / SKUD
