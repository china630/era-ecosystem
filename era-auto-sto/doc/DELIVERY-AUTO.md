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

## W2-E — Enrichment (Gemini СТО ERP)

PRD M5–M12 · note: M5 partially covered by A2 appointments

- [x] M6: Interactive intake (photos, damage checklist)
- [x] M8: Shop floor timer per job line
- [x] M9: Parts status on work order
- [x] M10: Vehicle history timeline by VIN/plate
- [ ] M5 extend: Bay/lift resource on calendar
- [ ] M7, M11, M12: deferred
