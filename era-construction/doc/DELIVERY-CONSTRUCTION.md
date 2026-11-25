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

## Access (RBAC Variant A)

- [~] CN-RBAC-01 Variant A access matrix: system packages, `/admin/access` (matrix, clone, Reset, assign), page + API grant doors — UAT-SMOKE UI step open ([ADR](../../docs/adr/construction-domain-permissions-and-rbac.md))

## Depth (boundaries fixed — [ADR](../../docs/adr/construction-domain-boundaries.md))

- [~] M13 Progress act lines (ops SOV) + richer approve payload for Finance (`ProgressActLine`, `PUT /api/progress-acts/:id/lines`) — SCREEN hub Ops; UAT open → not SHIPPED. Finance consumer idempotent on `construction:{actId}`
- [~] Wave 3 depth (parties, CDE supersede, richer daily/punch+pin, RFI/submittal, inspection→punch, change ops) — SCREEN hub Depth; UAT open → not SHIPPED
- [~] Wave 4 product hub — tabs (overview/estimate/ops/depth/structure/schedule/equipment/claims); structure/gantt/equipment/claims transitions; requisition status; FORBIDDEN client UX; UAT open → not SHIPPED
- [~] CN-BIM-01 BIM lite (`ifcElementId` / `externalViewerUrl`) — SKU-gated Ops + `/field-ops` + Depth; http(s) validate; UAT open → not SHIPPED
- [~] CN-STAFF-01 CP staff-provision — Nest Controller `POST /api/integration/staff-provision` + Orch `CONSTRUCTION_API_URL`; UAT hire→login open → not SHIPPED
- [~] M20 / CN-EST-01 Estimate hierarchy (5-level smeta) — dual mode per project; Nest Controllers + `@/lib/estimate.service`; approve → BoqLine + `SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED`; hub Estimate SCREEN; SKU `construction_estimate_hierarchy`; UAT open → not SHIPPED. Finance SOV seed consumer follow-up
- [x] Nest HTTP edge: native Controllers (`nest/native`) over `@/lib`; `nest:generate` retired; Nest edge without `next/*` (ADR construction-nest-native-controllers) — hosting only; does not flip SHIPPED

## Wave 1 — full satellite scaffold (STUB / empty shells)

- [~] M14–M18 deepened in Wave 3 (see Depth) — Wave 1 stub shells retired from hub
- [~] M19 Project phases / locations — Wave 4 Structure tab CRUD + soft-delete (not SHIPPED)
- [x] Soft-delete `deletedAt` on ops entities + CDE sheet lifecycle
- [s] `@era/contracts` construction event type stubs (no new Finance consumers in W3/W4)
- [x] Act lines UI on project hub Ops tab (Wave 2+)
- [x] Wave 1 closeout: CN-W1-SCAFFOLD-01 STUB; AC-CON-W1-SCAFFOLD 🟡 out of BE rollup; `check:acceptance` (2026-11-17)
- [x] Wave 4 closeout docs: CN-W4-PRODUCT-01 API/SCREEN; AC-CON-W4-PRODUCT 🟡 out of BE rollup; edition `mvp`; no Pilot/ga
