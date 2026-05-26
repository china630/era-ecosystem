# DELIVERY-LOGISTICS

PRD: [../PRD.md](../PRD.md)

## L0 (done)

- [x] PRD v1.0, scaffold, SSO, health, `/trips` placeholder
- [x] Event dispatch stub

## L1 — MVP

- [x] Fleet + Trip models
- [x] Complete trip → `SATELLITE_LOGISTICS_TRIP_COMPLETED` E2E
- [x] UI trip list + close

## L2

- [x] POD capture (L-04) — `GET/POST /api/trips/:id/pod`, form on `/trips/[id]`
- [x] Fuel report (L-05) — `GET/POST /api/trips/:id/fuel-report`, fleet rollup `GET /api/reports/fuel`
- [x] Trip detail UI — status PLANNED → IN_TRANSIT → DELIVERED → COMPLETE
- [x] Fuel summary page `/reports/fuel`

## L3

- [x] Customs status read from Finance — `/customs` hub + Finance deep link (SP7)

## L4 — Platform (Wave B3)

- [x] Notifications on trip complete — `@era/satellite-kit` `trySendPlatformNotification`
- [x] Portal + delivery on trip complete — `createPortalLink`, `createShipment` (Wave D)
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot` (Wave D)
- [x] Wave E-A commerce — portal/pay/delivery on trip complete (MVP)
- [x] Wave E-B booking — delivery window slot on trip complete (MVP)
- [x] Wave F §4 — loyalty/domains on trip complete

Client: `@era/satellite-kit`.

## SP8 — Platform RBAC consumer (§2.1)

- [x] Platform session via SSO — `PlatformSessionBarServer`
- [x] Local operational RBAC unchanged; no local Orch RBAC API (N/A)

## SP7 — Depth (post-quartet)

- [x] L2 POD + fuel reports (Wave 1)
- [x] L3 customs status hub `/customs` + Finance deep link

## W1-E — Enrichment

Source: [MODULES_CATALOG § enrichment](../../docs/MODULES_CATALOG.md#industry-enrichment-backlog-gemini-erp--era)

- [x] M3: Waybill document (generate/print stub per trip)
- [x] M7: Fleet compliance — vehicle doc expiry fields + alerts UI
- [x] M4: POD photo URL + signature URL on trip

## W2-E — Enrichment

- [x] M8: Multi-stop `trip_points`
- [x] M9: Driver mobile workflow API stub
- [x] M13: Customer tracking via platform_portal
- [ ] M10–M12: deferred (Finance / hub WMS)
