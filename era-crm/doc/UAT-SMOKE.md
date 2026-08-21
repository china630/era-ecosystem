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

- [ ] Login as user with `SALES_LEAD` or `BUSINESS_OWNER`
- [ ] Open `/leads` — pipeline loads; toggle **My leads** filters by owner
- [ ] Assign lead via dropdown → `PATCH /api/leads/:id/assign` with `{ "ownerId": "<userId>" }`
- [ ] Open `/visits` — log visit with lead + notes → `POST /api/visits`
- [ ] Verify orchestrator receives `SATELLITE_CRM_VISIT_LOGGED` (payload includes `ownerId`, `estimatedAmount` when set)
- [ ] Open `/inbox` — list thread stubs; create WA/IG thread via `POST /api/inbox`
- [ ] **Create lead** link from unlinked inbox thread pre-fills channel + contactRef on pipeline

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

curl http://localhost:3303/api/inbox \
  -H "Cookie: era_satellite_token=<token>"

curl -X POST http://localhost:3303/api/inbox \
  -H "Content-Type: application/json" \
  -H "Cookie: era_satellite_token=<token>" \
  -d '{"channel":"whatsapp","externalRef":"+994501234567","preview":"Hello"}'
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

## Deny (Scaffold BE negative paths — PIPE / PARTY only)

1. **Module off → 403:** With `industry_crm` inactive (or unbound org / source=fallback), routes that call `assertCrmEntitled` return **403**. Proof: `__tests__/crm-pipe-negative.spec.ts`, `crm-party-negative.spec.ts`.
2. **Domain denies (PIPE):** assign without `SALES_LEAD` / `BUSINESS_OWNER` → **403**; stage advance to QUALIFIED+ without party VÖEN/phone denied.
3. **Domain denies (PARTY):** legal entity missing company name; individual missing phone; import row without phone denied.
4. **WA:** not in this deny section — AC-CRM-WA remains External vendor (not Scaffold ✅).

