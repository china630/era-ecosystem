# UAT smoke — era-wholesale





## SSO paths (platform entry � v1.0)

### Owner path (Orchestrator)
1. Login at Orchestrator web: `http://localhost:3000` ([QUARTET_UAT.md](../../docs/QUARTET_UAT.md)).
2. Home → industry tile → **Open** → satellite `/sso/callback` session.
3. Smoke: `node scripts/sso-launch-smoke.mjs` (`ERA_SSO_SHARED_SECRET` aligned).

### Ops path (local)
1. Use this app's `/login` and seed users in sections below.
2. Billing, team, register → Orchestrator only (no satellite `/register`).



- [ ] `GET /api/health` → 200
- [ ] Home page loads
- [ ] `POST /api/events/dispatch` (with orchestrator running)

## Wholesale UI (modal CRUD)

- [ ] Login at `/login`
- [ ] Open `/admin/import-orders` → **Create import PO** modal → fill supplier VÖEN, currency, amount, terms, SKU
- [ ] Verify due-date preview and FX badge inside the modal
- [ ] Save import PO → row appears in import order list
- [ ] Confirm DRAFT row via **Confirm → Finance**

## Green Scaffold deny paths (BE Wave 1)

Automated proof: `npm test` in `era-wholesale` (`__tests__/ws-*-negative.spec.ts`).

- [ ] AC-WS-ORD: module inactive → `GET /api/orders` 403; confirm unknown id → 404
- [ ] AC-WS-PICK: `PATCH` pick line with `qtyPicked` > ordered → 400; unknown line → 404
- [ ] AC-WS-CREDIT: missing `counterpartyId` → 400; Finance down with `FINANCE_API_URL` set → 200 with `source: env_stub_fallback` (not `finance_api`)
- [ ] AC-WS-PLAT: `POST /api/events/dispatch` without service token → 401

