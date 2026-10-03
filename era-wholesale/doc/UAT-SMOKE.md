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

## WS-RBAC-01 — access matrix (SCREEN; not SHIPPED)

ADR: [wholesale-domain-permissions-and-rbac.md](../../docs/adr/wholesale-domain-permissions-and-rbac.md). Proof: `__tests__/wholesale-rbac*.spec.ts`.

- [ ] Log in as `WHOLESALE_MANAGER` → nav shows **Access** → `/admin/access` lists the six system packages (`SALES_REP`, `WAREHOUSE_PICKER`, `WHOLESALE_MANAGER`, `BUSINESS_OWNER`, `PLATFORM_MEMBER`, `SATELLITE_OPERATOR`).
- [ ] Log in as `SALES_REP` → nav has Orders and Pick lists, no Settings / Access; opening `/admin/import-orders` lands on `/login` with the "no access" message.
- [ ] As `WHOLESALE_MANAGER`: untick `api:orders.confirm` on `WAREHOUSE_PICKER` → Save → a picker's **Confirm** on `/orders` returns 403; **Reset to defaults** restores it.
- [ ] Clone `SALES_REP` as `KEY_ACCOUNT`, tick `admin:import_orders` and `screen:admin.import_orders` → assign a rep user to it in **Assign a role to a user** → that user opens `/admin/import-orders`; delete `KEY_ACCOUNT` is refused while the user holds it.
- [ ] `WHOLESALE_MANAGER` cannot assign `BUSINESS_OWNER` (403); SSO owner can.
