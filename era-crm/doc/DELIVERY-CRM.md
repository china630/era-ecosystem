# DELIVERY-CRM

PRD: [../PRD.md](../PRD.md)

## C0 — Platform (done)

- [x] PRD v1.0, TZ, finance boundary doc
- [x] Scaffold, SSO, health, `/leads` placeholder
- [x] Event dispatch stub

## C1 — MVP pipeline

- [x] Prisma: Lead, LeadStageHistory, Visit
- [x] UI: pipeline board + lead card
- [x] Convert → `SATELLITE_CRM_LEAD_CONVERTED` E2E
- [x] Doc: no duplicate counterparty create in satellite

## C2 — Field & inbox

- [x] Visits API — list/create (C-03) — `GET/POST /api/visits`
- [x] Visit logged event dispatch — `SATELLITE_CRM_VISIT_LOGGED`
- [x] Visit check-in UI — `/visits` list + log form
- [x] Agent assignment (C-06) — `PATCH /api/leads/:id/assign`, pipeline filter
- [x] Inbox stub (WA/IG metadata only) — `/inbox`, `InboxThread` model

## C3 — Deferred

- [x] Live WhatsApp Business API
- [x] `SATELLITE_CRM_VISIT_LOGGED` contract

## C4 — Platform add-ons (v1.0)

- [x] Notifications on lead convert — `@era/satellite-kit`
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot`
- [x] Portal/pay/shipment on lead convert (MVP)
- [x] Booking — `createBookingAppointment` follow-up on convert (MVP)
- [x] Loyalty/domains on lead convert

## Platform session (v1.0)

- [x] Platform session via SSO — `PlatformSessionBarServer`
- [x] Local operational RBAC unchanged; no local Orch RBAC API (N/A)

## Operations (v1.0)

- [x] C2 inbox + lead assign + visit log
- [x] Finance convert `POST /api/leads/:id/convert` + platform hooks

## Product modules (v1.0)

Source: [MODULES_CATALOG](../../docs/MODULES_CATALOG.md)

- [x] M4: Visit geo fields + optional map stub on `/visits`
- [x] M8: Next-contact reminder (`nextContactAt` + platform notification)
- [x] M9: Lead scoring stub

## Planned — v1.1

- [x] M10: Pipeline automation
