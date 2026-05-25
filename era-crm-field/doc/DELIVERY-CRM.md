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
