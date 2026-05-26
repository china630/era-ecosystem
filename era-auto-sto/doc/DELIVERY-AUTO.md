# DELIVERY-AUTO

PRD: [../PRD.md](../PRD.md)

## A0 (done)

- [x] PRD v1.0, scaffold, SSO, `/work-orders` placeholder

## A1 — MVP

- [x] Work order CRUD + close event E2E

## A2

- [x] Appointments (A-05) — `GET/POST /api/appointments`, `/appointments` UI

## A3 — Platform (Wave B3)

- [x] Notifications + booking slots cron — Live (`service-due`)
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot` (Wave D)
- [x] Wave E-A commerce — portal/pay on work order complete (MVP)
- [x] Wave F §4 — delivery/loyalty/domains on work order complete

Client: `@era/satellite-kit`.

## SP8 — Platform RBAC consumer (§2.1)

- [x] Platform session via SSO — `PlatformSessionBarServer`
- [x] Local operational RBAC unchanged; no local Orch RBAC API (N/A)

## SP7 — Depth (post-quartet)

- [x] Appointments UI `/appointments` + platform crons (service-due)
- [x] Work order complete → commerce/notifications (Wave E)
