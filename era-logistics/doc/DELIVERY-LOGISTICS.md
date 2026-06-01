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

## L4 — Platform add-ons (v1.0)

- [x] Notifications on trip complete — `@era/satellite-kit` `trySendPlatformNotification`
- [x] Portal + delivery on trip complete — `createPortalLink`, `createShipment`
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot`
- [x] Portal/pay/delivery on trip complete (MVP)
- [x] Booking — delivery window slot on trip complete (MVP)
- [x] Loyalty/domains on trip complete

Client: `@era/satellite-kit`.

## Platform session (v1.0)

- [x] Platform session via SSO — `PlatformSessionBarServer`
- [x] Local operational RBAC unchanged; no local Orch RBAC API (N/A)

## Operations (v1.0)

- [x] POD + fuel reports
- [x] Customs status hub `/customs` + Finance deep link

## Product modules (v1.0)

Source: [MODULES_CATALOG](../../docs/MODULES_CATALOG.md)

- [x] M3: Waybill document (generate/print stub per trip)
- [x] M7: Fleet compliance — vehicle doc expiry fields + alerts UI
- [x] M4: POD photo URL + signature URL on trip
- [x] M8: Multi-stop `trip_points`
- [x] M9: Driver mobile workflow API stub
- [x] M13: Customer tracking via platform_portal

## Planned — v1.1

- [x] M10: Rate matrix / tariff engine (Finance)
- [x] M11: COD split & clearing (Finance)
- [x] M12: Hub cross-dock scanning
