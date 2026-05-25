# UAT smoke — era-crm-field

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
