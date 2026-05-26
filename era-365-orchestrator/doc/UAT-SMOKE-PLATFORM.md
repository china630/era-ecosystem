# UAT smoke — Platform APIs (orchestrator :4100)

See billing reconcile: `npm run platform:billing-reconcile` from era-365-orchestrator root.

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

## CP-B3–B5 MVP

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
