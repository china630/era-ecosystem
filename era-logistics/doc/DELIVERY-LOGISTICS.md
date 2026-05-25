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

- [ ] Customs status read from Finance
