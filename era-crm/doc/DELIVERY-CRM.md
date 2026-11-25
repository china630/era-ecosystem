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
- [~] Bidirectional inbox (CRM-INBOX-01) — Conversation/Message + `/inbox` 3-col + outbox worker + WA 24h server gate; Telegram/WA Cloud adapters live; Meta sandbox UAT open — **not** a metadata-only stub — see [docs/adr/crm/](../../docs/adr/crm/README.md)

## C3 — Deferred / honesty

- [~] Live WhatsApp Business API — tenant `whatsapp_cloud` preferred; orch adapter Graph **v21** (no silent stub success; ENV fallback non-prod / loud warn; T-I10)
- [x] `SATELLITE_CRM_VISIT_LOGGED` contract

## Integrations layer (CRM-INT)

- [~] `@era/integrations-kit` + `/admin/integrations` + hooks + encrypted secrets (`CRM_INTEGRATIONS_KEK`)
- [~] Inbound worker (+ optional BullMQ `integration-inbound`) — hooks ACK fast (T-I05)
- [~] Outbox worker loop (+ optional BullMQ `integration-outbound`)
- [~] Meta OAuth callback + Instagram/Messenger start (T-I12; needs META_APP_*)
- [~] Email IMAP poller + SMTP send (T-I13; needs imapflow/nodemailer)
- [~] Asterisk bridge Originate HTTP + extensions map / missed-call assignee (T-I20/T-I21)
- [~] ICS tasks feed `/api/integrations/ics/:token` (E4)
- [~] Unsorted Accept/Link/Reject, tasks, reports, convert side-effect flags (defaults **opt-in** except payment link)
- [~] P1 slice A: Viber/VK/MAX + FB Messenger + Meta Lead Ads + Megafon/Gravitel/MTS VATS; outbound webhooks + tenant API keys; Digital Pipeline lite (T-I22/23/25/29 + P1-1) — UAT open
- [~] P1 slice B: Gmail/MS Graph mail (validationToken) + IMAP UIDVALIDITY + Google/M365 calendar; Wazzup + Twilio WA; Rostelecom/Beeline/UIS/OnlinePBX/Telphin/Twilio Voice (T-I24/26/27/28) — keys/UAT open
- [~] I-4 / product P1 slice: Green-API (risk gate), OK/WeChat/LINE, Meta CAPI + GA4 MP, Twilio SMS, 3CX, `era_externalcall`; Contact/Company + lead merge + CustomFieldDef/tags + SalesGoal; E5 payment status on lead; bot-lite `autoReply` on PipelineRule; PWA manifest/SW; Clinic inquiry pipeline template — SCREEN/API; UAT open; not SHIPPED
- [~] Vendor-06 (ADR crm/06): kit K1–K8; VirtualATS.az + LSIM hash + Zadarma/Novofon + Gravitel REST; Mango/Sipuni/VATS CRM live-bugs; era-pbx-bridge duration/recording — fixture/unit DoD; live keys later; not SHIPPED
- [ ] MSM.az SMS live adapter — **blocked** until HTTP/XML API pack from info@msm.az (catalog `msm_az` honest fail; TZ T-I27)
- [ ] Collabo.az telephony — **blocked** until vendor API spec (catalog honest fail; or `generic_call_webhook`)
- [ ] Remaining P2 CPaaS long-tail on demand (Vonage/Plivo/… catalog blocked://) — TZ I-4

## C4 — Platform add-ons (v1.0)

- [x] Notifications on lead convert — `@era/satellite-kit`
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot`
- [~] Portal/pay/shipment on lead convert — gated by `/admin/settings` convert flags (defaults off except payment link)
- [~] Booking — gated by convert flags (default off)
- [~] Loyalty/domains on lead convert — gated by convert flags (default off)

## Platform session (v1.0)

- [x] Platform session via SSO — `PlatformSessionBarServer`
- [x] Local operational RBAC unchanged; no local Orch RBAC API (N/A)
- [~] CRM-RBAC-01 Variant A access matrix: system packages, `/admin/access` (matrix, clone, Reset, assign), page + API grant doors — UAT-SMOKE UI step open ([ADR](../../docs/adr/crm/crm-domain-permissions-and-rbac.md))

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

## Planned — v3.0 (party model, partners, import)

ADR: [crm-lead-party-model-and-prospect-import](../../docs/adr/crm-lead-party-model-and-prospect-import.md) · PRD §9 · audit [V3-AUDIT.md](./V3-AUDIT.md)

- [x] M11: Lead party profile — `partyKind`, `taxId`, `companyName`, phone, `activitySector`, `prospectType`
- [x] M12: Lead card page `/leads/[id]`
- [x] M13: Create lead UI on `/leads` (persist VÖEN lookup)
- [x] M14: CSV/XLSX import — `POST /api/leads/import`, dedup, import report
- [x] M15: Finance auto-counterparty on convert (extended event contract)
- [x] M16: Individual FIN via MDM — `globalPersonId` on lead
- [x] Stage validation — VÖEN required QUALIFIED+ for legal entities
- [x] COVERAGE_MATRIX rows CRM-PARTY-01/02, CRM-IMPORT-01/02, CRM-CONV-01
- [x] UAT-SMOKE UI: create lead → qualify → convert → Finance CP visible
