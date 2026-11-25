# UAT smoke — era-crm





## SSO paths (platform entry � v1.0)

### Owner path (Orchestrator)
1. Login at Orchestrator web: `http://localhost:3000` ([QUARTET_UAT.md](../../docs/QUARTET_UAT.md)).
2. Home → industry tile → **Open** → satellite `/sso/callback` session.
3. Smoke: `node scripts/sso-launch-smoke.mjs` (`ERA_SSO_SHARED_SECRET` aligned).

### Ops path (local)
1. Use this app's `/login` and seed users in sections below.
2. Billing, team, register → Orchestrator only (no satellite `/register`).



## C0 — Shell

- [ ] `GET /api/health` → 200
- [ ] Home page loads
- [ ] `POST /api/events/dispatch` (with orchestrator running)

## C2 — Field & inbox

- [ ] Login as a user whose role holds `api:leads.assign` (default `SALES_LEAD`) or as the owner
- [ ] Open `/leads` — pipeline loads; toggle **My leads** filters by owner
- [ ] Assign lead via dropdown → `PATCH /api/leads/:id/assign` with `{ "ownerId": "<userId>" }`
- [ ] Open `/visits` — log visit with lead + notes → `POST /api/visits`
- [ ] Verify orchestrator receives `SATELLITE_CRM_VISIT_LOGGED` (payload includes `ownerId`, `estimatedAmount` when set)
- [ ] Open `/inbox` — 3-column conversations (list / chat / lead); polling refresh
- [ ] As SALES_AGENT without `api:leads.assign` — `GET /api/leads/<otherOwnerLeadId>` → 403 (record scope)
- [ ] While logged in — RINGING toast appears when `/api/realtime/calls` reports a call (SSE)
- [ ] SatAdmin `/admin/integrations` — create mock_telegram connection, Test, Enable; webhook URL visible; secrets masked
- [ ] POST signed webhook to `/api/integrations/hooks/mock_telegram/:publicId` → Message + unsorted Lead
- [ ] Open `/unsorted` — Accept / Link / Reject on inbound draft; pipeline list hides unsorted by default
- [ ] Open `/leads/[id]` — Activity timeline shows STAGE/SYSTEM rows after stage change / convert
- [ ] `/admin/settings` — toggle convert side effects; convert respects flags
- [ ] Open `/reports` — funnel stage counts + unsorted + link to queue
- [ ] Follow-up on lead creates Task for assignee (not `lead-<id>@local` notify)

### C2 curl smoke

```bash
curl http://localhost:3303/api/health

curl -X PATCH http://localhost:3303/api/leads/<leadId>/assign \
  -H "Content-Type: application/json" \
  -H "Cookie: era_satellite_token=<token>" \
  -d '{"ownerId":"<userId>"}'

curl "http://localhost:3303/api/leads?mine=true" \
  -H "Cookie: era_satellite_token=<token>"

curl -X POST http://localhost:3303/api/visits \
  -H "Content-Type: application/json" \
  -H "Cookie: era_satellite_token=<token>" \
  -d '{"leadId":"<leadId>","notes":"Site visit"}'

curl http://localhost:3303/api/conversations \
  -H "Cookie: era_satellite_token=<token>"

curl -X POST "http://localhost:3303/api/conversations/<conversationId>/messages" \
  -H "Content-Type: application/json" \
  -H "Cookie: era_satellite_token=<token>" \
  -d '{"text":"Hello","connectionId":"<connectionId>"}'
# Expect 400 OUTSIDE_WINDOW when WhatsApp-family and lastInboundAt > 24h without templateName
```

## Product modules (v1.0)

- [x] M4: `POST /api/visits` with `latitude`, `longitude`, `addressLabel` → stored; `/visits` shows geo
- [x] M8: `PATCH /api/leads/:id/follow-up` with `nextContactAt` → notification stub; `/leads` schedule follow-up

## C5–C8 — v3.0 party model + import (UI smoke)

- [ ] Login at `/login`
- [ ] `/leads` → **Create lead** modal — legal entity with VÖEN lookup + company name; or individual with phone
- [ ] Set `prospectType=PARTNER`; filter pipeline by Partner
- [ ] Open `/leads/[id]` — party block, stage history, visits
- [ ] Move lead to QUALIFIED (requires VÖEN for legal entity) → PROPOSAL → **Convert**
- [ ] Finance: counterparty auto-created (`handleCrmLead`); draft invoice if `estimatedAmount` set
- [ ] `/admin/import` → **Run import** modal — upload sample slice of `data/legal-entities/azerbaijan-companies-with-voen.csv`; verify import report

### v3.0 curl smoke (`:3207` local dev)

```bash
curl http://localhost:3207/api/health

curl -X POST http://localhost:3207/api/leads \
  -H "Content-Type: application/json" \
  -H "Cookie: era_satellite_token=<token>" \
  -d '{"title":"Partner MMC","partyKind":"LEGAL_ENTITY","taxId":"1234567890","companyName":"Partner MMC","contactPhone":"+994501234567","prospectType":"PARTNER","activitySector":"hotels"}'

curl -X PATCH http://localhost:3207/api/leads/<leadId>/stage \
  -H "Content-Type: application/json" \
  -H "Cookie: era_satellite_token=<token>" \
  -d '{"stage":"QUALIFIED"}'

curl -X POST http://localhost:3207/api/leads/<leadId>/convert \
  -H "Cookie: era_satellite_token=<token>"

curl -X POST http://localhost:3207/api/mdm/person-lookup \
  -H "Content-Type: application/json" \
  -H "Cookie: era_satellite_token=<token>" \
  -d '{"fin":"ABC1234","fullName":"Test User"}'

curl -X POST "http://localhost:3207/api/leads/import?mode=upsert" \
  -H "Cookie: era_satellite_token=<token>" \
  -F "file=@../data/legal-entities/azerbaijan-legal-entities.csv"
```

## CRM-SEL-01 / CRM-WAR-01 — selections + warranty (SCREEN; not SHIPPED)

1. Open `/leads/[id]` after convert (or seed) — Selections empty state when no package items.
2. **Add selection item** ModalShell → code / label / amount → list refreshes; status CatalogField updates.
3. **Add warranty** ModalShell → subject (required), optional construction project id, notes → case appears; status CatalogField updates.
4. Soft-gate copy when `crm_selections` / `crm_warranty` modules are off (if gate wired for the session).

Evidence: unsigned — **SCREEN only; not SHOW / not SHIPPED**.

## Deny (Scaffold BE negative paths — PIPE / PARTY only)

1. **Module off → 403:** With `industry_crm` inactive for the session org, routes (module gate inside `getSatelliteSession()`) return **403**. Proof: `__tests__/crm-pipe-negative.spec.ts`, `crm-party-negative.spec.ts`.
2. **Domain denies (PIPE):** assign without `api:leads.assign` → **403**; stage advance to QUALIFIED+ without party VÖEN/phone denied.
3. **Domain denies (PARTY):** legal entity missing company name; individual missing phone; import row without phone denied.
4. **WA:** not in this deny section — AC-CRM-WA remains External vendor (not Scaffold ✅).

## Integrations + product P1 (SCREEN/API; not SHIPPED)

- [ ] `/admin/integrations` — catalog includes MSM/Collabo as awaiting-spec; Test fails honestly
- [ ] `/admin/custom-fields` — create TEXT/SELECT def → visible on `/leads/[id]` → save custom values + tag
- [ ] `/parties` — create company + contact
- [ ] `/leads/[id]` merge — survivor keeps visits; duplicate deleted
- [ ] `/reports` — create sales goal → fact shows
- [ ] Convert with payment link → lead shows Payment (E5) status LINK_ISSUED; **Mark paid** → PAID
- [ ] PipelineRule `MESSAGE_IN` + `actionJson.autoReply` → outbound queued (bot lite)
- [ ] PWA: `/manifest.webmanifest` 200; service worker registers (DevTools)
- [ ] Seed `Clinic inquiry` pipeline via `prisma/scripts/seed-default-pipeline.ts` (CRM stages only)

Evidence unsigned — **not SHOW / not SHIPPED**. MSM/Collabo/Meta sandbox remain external blockers.

## CRM-RBAC-01 — access matrix (SCREEN; not SHIPPED)

ADR: [crm-domain-permissions-and-rbac.md](../../docs/adr/crm-domain-permissions-and-rbac.md). Proof: `__tests__/crm-rbac*.spec.ts`.

- [ ] Log in as `SALES_LEAD` → nav shows **Access** → `/admin/access` lists the six system packages (`SALES_AGENT`, `SALES_LEAD`, `FIELD_REP`, `BUSINESS_OWNER`, `PLATFORM_MEMBER`, `SATELLITE_OPERATOR`).
- [ ] Log in as `SALES_AGENT` → nav has no Import / Settings / Access; opening `/admin/import` lands on `/login` with the "no access" message; `/leads` shows no assign control.
- [ ] As `SALES_LEAD`: untick `api:leads.assign` on `SALES_LEAD` → Save → the assign control disappears and assign returns 403; **Reset to defaults** restores it.
- [ ] Clone `SALES_AGENT` as `KEY_ACCOUNT`, tick `api:leads.assign` → assign an agent user to it in **Assign a role to a user** → that user can assign leads; delete `KEY_ACCOUNT` is refused while the user holds it.
- [ ] `SALES_LEAD` cannot assign `BUSINESS_OWNER` (403); SSO owner can.

