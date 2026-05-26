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

## C3 — Platform (Wave B3)

- [x] Notifications on progress act approve — `@era/satellite-kit`
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot` (Wave D)
- [x] Wave E-A commerce — portal/pay on progress act; delivery on material requisition (MVP)
- [x] Wave E-B booking — `createBookingSlot` site-visit on progress act approve (MVP)
- [x] Wave F §4 — loyalty/domains on progress act approve

## SP8 — Platform RBAC consumer (§2.1)

- [x] Platform session via SSO — `PlatformSessionBarServer`
- [x] Local operational RBAC unchanged; no local Orch RBAC API (N/A)

## SP7 — Depth (post-quartet)

- [x] Plan vs actual UI + cost hooks via progress acts (Wave 2/4)
- [x] Platform commerce/booking on progress act (Wave E)

## W2-E — Enrichment (Gemini строительная ERP)

PRD M6–M12 · [MODULES_CATALOG](../../docs/MODULES_CATALOG.md)

- [x] M6: Field daily log API + mobile form
- [x] M7: Punch list / defect tracker
- [x] M9: Subcontractor claim stub
- [ ] M8, M10, M11, M12: deferred per PRD
