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

- [ ] Live WhatsApp Business API
- [x] `SATELLITE_CRM_VISIT_LOGGED` contract

## C4 — Platform (Wave B3)

- [x] Notifications on lead convert — `@era/satellite-kit`
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot` (Wave D)
- [x] Wave E-A commerce — portal/pay/shipment on lead convert (MVP)
- [x] Wave E-B booking — `createBookingAppointment` follow-up on convert (MVP)
- [x] Wave F §4 — loyalty/domains on lead convert

## SP8 — Platform RBAC consumer (§2.1)

- [x] Platform session via SSO — `PlatformSessionBarServer`
- [x] Local operational RBAC unchanged; no local Orch RBAC API (N/A)

## SP7 — Depth (post-quartet)

- [x] C2 inbox + lead assign + visit log (Wave 1)
- [x] Finance convert `POST /api/leads/:id/convert` + platform hooks (Wave E)

## W1-E — Enrichment

Source: [MODULES_CATALOG § enrichment](../../docs/MODULES_CATALOG.md#industry-enrichment-backlog-gemini-erp--era)

- [x] M4: Visit geo fields + optional map stub on `/visits`
- [x] M8: Next-contact reminder (`nextContactAt` + platform notification)

## W2-E — Enrichment

- [x] M9: Lead scoring stub
- [ ] M10: Pipeline automation — deferred
