# UAT smoke — Platform APIs (orchestrator :4100)

See billing reconcile: `npm run platform:billing-reconcile` from era-orchestrator root.

Payment webhooks: `POST https://<cp-host>/v1/billing/webhooks/pasha_bank` — set `BILLING_WEBHOOK_PUBLIC_URL`.

## CP-BILLING cutover (§2.2 Live)

1. `GET /v1/subscription/me` with Owner JWT — modules, tier, trial window.
2. Finance web `/settings/subscription` loads via `/cp` rewrite (billing summary + invoices list).
3. `GET /v1/billing/summary`, `GET /v1/billing/invoices` — same Bearer.
4. `GET /v1/public/pricing` — no auth.
5. `npm run platform:billing-reconcile` — zero drift vs Finance legacy (if any).
6. Provider webhook: `POST /v1/billing/webhooks/pasha_bank` sample payload — idempotent ack.

## CP-B2 Notifications (§2.3 Live)

1. `POST /platform/notifications/v1/send` — entitlement `platform_notifications`.
2. `GET /platform/notifications/v1/outbox` — message row created.
3. Finance: `ERA_NOTIFICATION_PACK=true`, issue sales invoice with email — outbox + optional pay link.
4. Satellites: retail pay, logistics trip complete — transactional send (best-effort).

## SP9 — Launcher web (M9 DONE)

1. Open `http://localhost:3000` — industry module grid loads for entitled org.
2. Owner SSO → tile **era-retail-pos** (or any satellite) → **Open** → satellite session.
3. `node scripts/sso-launch-smoke.mjs` from umbrella root (`ERA_SSO_SHARED_SECRET` aligned).

## Public hub (2026-05-30)

1. `GET http://localhost:3000/pricing` — 200; module prices from `GET /v1/public/pricing`.
2. `GET http://localhost:3000/help` — FAQ renders in az (default), ru, en via locale toggle.
3. `GET http://localhost:3000/terms` — user agreement page.
4. `GET http://localhost:3000/register` — signup; `?ref=CODE` stored for org registration.
5. Finance `http://localhost:3100/pricing` and `/register` redirect to Orch (no loop when `NEXT_PUBLIC_ORCH_WEB_URL=:3000`).
6. Satellite `/login` — `AuthLoginCard`, locale toggle works (`POST /api/locale` without session).

## CP-B3–B8 Live

1. `POST /platform/payments/v1/payment-links` — Finance invoice + wholesale confirm.
2. `POST /platform/portal/v1/links` — clinic lab publish.
3. `POST /platform/booking/v1/slots` — retail pay, auto-sto cron.
4. Clinic cron `POST /api/cron/appointment-reminders` (Bearer `PLATFORM_CRON_SECRET`).

## Hotel §2.4

1. `SATELLITE_HOTEL_INVOICE_ISSUED` via orchestrator gateway.
2. Finance dispatch creates draft sales invoice.
3. Guest notification on issue-invoice when phone present.

## Idempotency §2.4

Replay same satellite event `correlationId` on Finance — second post must not duplicate GL (`satellite_events_processed`).

## CP-B6 Loyalty (MVP)

Prereq: org has `platform_loyalty` in active modules.

1. `POST /platform/loyalty/v1/promotions` body:
   ```json
   { "code": "WELCOME10", "name": "Welcome", "discountType": "PERCENT", "discountValue": 10 }
   ```
2. `GET /platform/loyalty/v1/promotions?code=WELCOME10` — returns persisted promotion.
3. Upsert same `code` with new `discountValue` — updates row.

## CP-B7 Domains (MVP)

Prereq: `platform_domain`.

1. `POST /platform/domains/v1/domains` body `{ "hostname": "shop.example.az" }` — status `PENDING_DNS`, `dnsHint` in response.
2. Repeat same hostname — `409 Conflict`.

## CP-B8 Delivery (MVP)

Prereq: `platform_delivery`.

1. `POST /platform/delivery/v1/shipments` body:
   ```json
   {
     "sourceEntityType": "retail_receipt",
     "sourceEntityId": "<uuid>",
     "recipientPhone": "+994501234567"
   }
   ```
2. Response includes `trackingToken` (hex).
3. Retail: pay receipt with `{ "delivery": true }` or outlet preset `ecommerce` — best-effort `createShipment`.

## Hotel spa booking (CP-B3)

1. Hotel-pms: `CONTROL_PLANE_URL`, `ERA_SATELLITE_ORGANIZATION_ID`, service token.
2. `POST /api/spa/slots` body:
   ```json
   {
     "resourceKey": "spa-cabin-1",
     "startsAt": "2026-06-01T10:00:00.000Z",
     "endsAt": "2026-06-01T11:00:00.000Z",
     "capacity": 1
   }
   ```
3. Orchestrator `bookable_resources` + `booking_slots` rows created.

## DB tables (Wave C)

Apply to shared PostgreSQL (or `npx prisma db push` in `packages/database`):

- `platform_promotions`
- `platform_custom_domains`
- `platform_shipments`

## Wave E-A — Commerce hooks

1. Construction progress act approve — portal + pay via CP.
2. CRM lead convert — portal + optional pay/shipment.
3. Wholesale order confirm — portal, pay, optional shipment + pickup slot.
4. Logistics trip complete — portal, pay, shipment, delivery slot.
5. Hotel folio invoice — portal + pay; FB ticket pay — portal + pay.

## Wave E-B — Booking

1. GET /platform/booking/v1/slots?resourceKey=pickup — list after retail/wholesale confirm.
2. FB ticket pay — fb-table-{tableId} slot created.
3. CRM convert — follow-up appointment.

## Wave E-C — CP2 / billing UI

1. Login — JWT includes permissions[] (role map).
2. GET /.well-known/jwks.json — optional key when ERA_JWT_RS256_JWK set.
3. `node scripts/jwks-auth-smoke.mjs` — Orch token accepted by Finance API.
4. Orch Finance tile — `?ticket=` handoff (no JWT in query).
5. Hotel GET /api/hotel/integration-settings — platformSubscription from CP.
6. POST internal/v1/quota/assert — whatsapp kind (Finance parity).

## Consumer Live (CP-B3–B8)

| Addon | Apps with owner-visible surface |
|-------|----------------------------------|
| portal | Retail `/platform`, Clinic lab publish, Wholesale confirm |
| payments | Retail receipt pay, Finance invoice issue |
| booking | Auto appointments, Clinic cron, Hotel spa slots |
| delivery | Retail/Logistics commerce hooks |
| loyalty/domains | Receipt pay / progress act hooks |


## Wave F — Loyalty + domains + delivery

1. Retail receipt pay — createPromotion + optional createCustomDomain (customHostname).
2. Wholesale confirm — B2B-ORDER promotion.
3. Hotel folio invoice — createShipment + HOTEL-FOLIO promotion.
4. FB ticket pay with delivery:true — createShipment.
5. node scripts/readiness-coverage.mjs — consumer delivery/loyalty/domains at 100% (10/10).

## CP-REFERENCE-DATA — Data Hub API keys (Pass 2)

1. Enable module `platform_reference_data` on test org (or `REFERENCE_DATA_SKIP_ENTITLEMENT=1` on orchestrator).
2. `POST http://127.0.0.1:4000/platform/reference-data/v1/validate-key` with `Authorization: Bearer <CONTROL_PLANE_SERVICE_TOKEN>` and body `{ "apiKey": "dev-data-hub-key" }` — expect `{ valid: true, organizationId, metered: true }`.
3. Data hub `PLATFORM_REFERENCE_DATA_MODE=live` + same key — `GET http://127.0.0.1:4200/registry/v1/fx/rates?symbols=USD` with `X-Api-Key` — 200.
4. Invalid key — 401 from validate-key; hub returns `INVALID_API_KEY`.

## Deny (Green Scaffold BE Wave 7)

Proof suites: `era-orchestrator/apps/api/src/**/cp-*-negative.spec.ts` (BILL/MDM/WF/SA/INT/BIND/CFG). AUTH deny also in `UAT-SMOKE-RBAC.md`.

| AC | Deny check | Expect |
|----|------------|--------|
| BILL | Owner invoice PDF / billing mutate as non-owner or foreign invoice id | **403** (`BILLING_OWNER_ONLY` / `BILLING_INVOICE_ACCESS`); no subscription → `SUBSCRIPTION_MISSING` |
| MDM | `POST /internal/v1/mdm/persons/lookup-by-fin` without service token | **401** |
| WF | `POST /platform/v1/workforce/employments/hire` as ACCOUNTANT (not OWNER/HR_MANAGER) | **403**; org without `platform_workforce` → `PLATFORM_WORKFORCE_REQUIRED` |
| SA | `GET /v1/admin/organizations` as non-super-admin JWT | **403** |
| INT | Platform catalog / satellite gateway with wrong Bearer; plus `npm run audit:integration:strict` | **401** + CI gate |
| BIND | `POST {satellite}/api/internal/v1/organization/bind` without / bad Bearer | **401** |
| CFG | `POST …/runtime-config` without Bearer → **401**; body `{ "ssoSharedSecret": "too-short" }` with valid Bearer → **400** |

```bash
# BIND deny (any satellite with kit handlers, e.g. clinic :3202)
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:3202/api/internal/v1/organization/bind \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"00000000-0000-4000-8000-000000000001"}'
# expect 401 when SATELLITE_EVENT_SERVICE_TOKEN is set

# CFG short SSO
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:3202/api/internal/v1/runtime-config \
  -H "Authorization: Bearer $SATELLITE_EVENT_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ssoSharedSecret":"too-short"}'
# expect 400
```

AC-CP-TOPO remains **not** Scaffold ✅ — do not treat PlacementJob API as SHARED pool sell. Host apply / field migrate still open.

### Lab hop (SaaS Wave 7)

CI: `placement-job.service.spec.ts` — SHARED→DEDICATED full advance chain; SHARED↔ONPREM REJECTED. Signoff: [`reports/placement-lab-hop-signoff.md`](../../reports/placement-lab-hop-signoff.md).

```bash
cd era-orchestrator/apps/api && npm test -- --testPathPattern=placement-job.service
```

### Lab dump (SaaS Wave 11) — hotel curated JSON slice

Between Wave 7 hop and field host apply:

1. Hotel CI: `npm test -- --testPathPattern=saas-wave11-placement-slice` in `era-hotel-pms`.
2. Orch CI with `ERA_PLACEMENT_SLICE_LAB=1` (suite sets this) — `sliceMeta.note` matches `hotel curated json slice v1`, not `not implemented full dump`.
3. Live hotel (optional): `POST {hotel}/api/internal/v1/placement/export-slice` with Bearer `SATELLITE_EVENT_SERVICE_TOKEN` and `{ "organizationId": "<uuid>", "includeRows": false }` → `rowCounts` + `formatVersion: 1`.

Curated models: role → user → guest. Host compose/restore still **pending**.
Host agent `scripts/era-placement-agent.mjs` polls PENDING/PROVISION and **logs** apply steps only (no live dump/compose).

## UI paths (SCREEN — no Demo/TE sign-off yet)

Walk in Orchestrator web (`:3000`) without curl. Do **not** mark Product-Readiness UI/Demo ✅ from this list alone.

| Surface | Path | Check |
|---------|------|-------|
| Workforce employments | `/workspace/workforce/employments` | ⋯ Login & access: `emp-{staffCode}` + copy org ID + Open login |
| Workforce vacation | `/workspace/workforce/vacation-plans` | list + submit/approve modal |
| Personnel orders | `/workspace/workforce/personnel-orders` | list |
| Staff schedule | `/workspace/workforce/staff-schedule` | list |
| Timesheets | `/workspace/workforce/timesheets` | list |
| Org catalog | `/super-admin/orgs` | search + open hub |
| Referrals | `/super-admin/referrals` | list |
| Landing | `/super-admin/landing` | list |
| Owner billing | `/settings/subscription`, `/settings/invoices`, `/settings/orders` | pages load for owner |
| Placement hop | `/super-admin/orgs/{id}/placement` | create SHARED→DEDICATED; advance lab states; create SHARED→ONPREM shows REJECTED (Wave 7 lab) |
