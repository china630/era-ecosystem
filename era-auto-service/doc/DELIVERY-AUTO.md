# DELIVERY-AUTO

PRD: [../PRD.md](../PRD.md)

## A0 (done)

- [x] PRD v1.0, scaffold, SSO, `/work-orders` placeholder

## A1 — MVP

- [x] Work order CRUD + close event E2E

## A2

- [x] Appointments (A-05) — `GET/POST /api/appointments`, `/appointments` UI

## A3 — Platform add-ons (v1.0)

- [x] Notifications + booking slots cron — Live (`service-due`)
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot`
- [x] Portal/pay on work order complete (MVP)
- [x] Delivery/loyalty/domains on work order complete

Client: `@era/satellite-kit`.

## Platform session (v1.0)

- [x] Platform session via SSO — `PlatformSessionBarServer`
- [x] Local operational RBAC unchanged; no local Orch RBAC API (N/A)

## Operations (v1.0)

- [x] Appointments UI `/appointments` + platform crons (service-due)
- [x] Work order complete → commerce/notifications

## Product modules (v1.0)

PRD M5–M12 · [MODULES_CATALOG](../../docs/MODULES_CATALOG.md) · M5 base covered by A2 appointments

- [x] M6: Interactive intake (photos, damage checklist)
- [x] M8: Shop floor timer per job line
- [x] M9: Parts status on work order
- [x] M10: Vehicle history timeline by VIN/plate

## Planned — v1.1

- [x] M5 extend: Bay/lift resource on calendar
- [x] M7: Parts catalogue VIN / cross
- [x] M11: B2B parts order from WO

## Planned — v2.0

- [x] M12: Tool crib / equipment

## Maturity — Auto core lines

- [x] M1: Customer vehicle card (`CustomerVehicle`, `/api/vehicles`, WO create links vehicle)
- [x] M3: Labor lines (`WorkOrderLaborLine`, roll-up to `laborAmount` on complete)
- [x] M4: Parts lines (`WorkOrderPartLine`, roll-up to `partsAmount` on complete)
