# DELIVERY-WHOLESALE

PRD: [../PRD.md](../PRD.md)

## W0 (done)

- [x] PRD v1.0, scaffold, `/orders` placeholder

## MVP — B2B order (v1.0)

- [x] B2B order + confirm shipment event E2E

## Pick & credit (v1.0)

- [x] Pick list API — `GET/POST /api/pick-lists`, `/pick-lists` UI + line confirm
- [x] Credit limit — `GET /api/credit-limit?counterpartyId=` (Finance API with env stub fallback)

## Platform add-ons (v1.0)

- [x] Notifications + payment link on order confirm
- [x] Portal link on order confirm — `createPortalLink`
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot`
- [x] Shipment on confirm when `delivery: true` (MVP)
- [x] B2B pickup slot on order confirm (MVP)
- [x] Loyalty/domains on order confirm (`customHostname`)
- [x] Credit limit **Live** when `FINANCE_API_URL` set ([credit-limit route](../app/api/credit-limit/route.ts))

Client: `@era/satellite-kit`.

## Platform session (v1.0)

- [x] Platform session via SSO — `PlatformSessionBarServer`
- [x] Local operational RBAC unchanged; no local Orch RBAC API (N/A)

## Operations (v1.0)

- [x] Pick lists UI + API
- [x] Finance credit limit fallback on confirm (live when `FINANCE_API_URL` set)
- [x] Admin settings UI playbook `/admin/settings`

## Product modules (v1.0)

- [x] M5: Delivery note / TTN print per order
- [x] M6: Pick wave grouping UI

## Planned — v1.1

- [x] M7: EDI / buyer API export
