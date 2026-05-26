# DELIVERY-WHOLESALE

PRD: [../PRD.md](../PRD.md)

## W0 (done)

- [x] PRD v1.0, scaffold, `/orders` placeholder

## W1 — MVP

- [x] B2B order + confirm shipment event E2E

## W2

- [x] Pick list API — `GET/POST /api/pick-lists`, `/pick-lists` UI + line confirm
- [x] Credit limit — `GET /api/credit-limit?counterpartyId=` (Finance API with env stub fallback)

## W3 — Platform (Wave B3)

- [x] Notifications + payment link on order confirm
- [x] Portal link on order confirm — `createPortalLink` (Wave D)
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot` (Wave D)
- [x] Wave E-A commerce — shipment on confirm when `delivery: true` (MVP)
- [x] Wave E-B booking — B2B pickup slot on order confirm (MVP)
- [x] Wave F §4 — loyalty/domains on order confirm (`customHostname`)
- [x] Credit limit **Live** when `FINANCE_API_URL` set ([credit-limit route](../app/api/credit-limit/route.ts))

Client: `@era/satellite-kit`.

## SP8 — Platform RBAC consumer (§2.1)

- [x] Platform session via SSO — `PlatformSessionBarServer`
- [x] Local operational RBAC unchanged; no local Orch RBAC API (N/A)

## SP7 — Depth (post-quartet)

- [x] Pick lists UI + API (Wave 2)
- [x] Finance credit limit fallback on confirm (live when `FINANCE_API_URL` set)
- [x] Admin settings UI playbook `/admin/settings`

## W2-E — Enrichment

- [x] M5: Delivery note / TTN print per order
- [x] M6: Pick wave grouping UI
- [ ] M7: EDI export deferred
