# DELIVERY-RETAIL

Source of truth for checkboxes. Summary for PM: [PRD §4](../PRD.md).

## R0 — Platform (done)

- [x] PRD v1.0 / TZ / clone-spec / presets docs
- [x] Next.js + Prisma scaffold
- [x] SSO exchange + middleware
- [x] Health API
- [x] Main screen + `/pos` placeholder
- [x] Event dispatch (Zod + orchestrator gateway)

## R1 — MVP checkout (target)

- [x] Prisma: Register, Shift, Receipt, ReceiptLine
- [x] API: shift open/close, receipt create/pay
- [x] UI: checkout screen (preset-agnostic)
- [x] E2E: paid receipt → `SATELLITE_RETAIL_SALE_COMPLETED` → Finance worker log
- [x] UAT: [UAT-SMOKE](./UAT-SMOKE.md) R1 section

## R2 — Presets

- [x] grocery: PLU / weighted line config (R-06)
- [x] apparel: variant line config (R-07)
- [x] electronics: serial line config (R-08)
- [x] pharmacy: OTC + Rx gate config (R-09, R-10)
- [x] `GET /api/presets` — preset config registry

## R3 — Returns & shift event

- [x] Void receipt (R-11) — `POST /api/receipts/:id/void`
- [x] Return receipt (R-12) — `POST /api/receipts/:id/return`
- [x] `SATELLITE_RETAIL_SHIFT_CLOSED` in @era/contracts
- [x] Shift close dispatch

## R4 — Product modules (v1.0)

Source: [MODULES_CATALOG](../../docs/MODULES_CATALOG.md) · **M11/M12 retail-only**

- [x] M11: Apply promotion on cart before pay (%, manual code)
- [x] M12: Customer phone / loyalty ref on receipt
- [x] M7: Product lookup read cache (`GET /api/products/search`)
- [x] M2 extend: X-report mid-shift API + UI
- [x] M13: BOPIS / pickup via platform_delivery

## R5 — Platform add-ons (v1.0)

- [x] Notifications on receipt pay — `trySendPlatformNotification` + optional payment link (`@era/satellite-kit`)
- [x] Booking pickup slot on pay — `createBookingSlot` (MVP)
- [x] Platform delivery shipment on pay — `createShipment` when `delivery: true` or outlet preset `ecommerce` (MVP)
- [x] Loyalty/domains on receipt pay (`customHostname`)
- [x] Portal link on pay — `createPortalLink` for `retail_receipt` (MVP)
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot` → `getSubscriptionMe`
- [x] UAT: platform send documented in [UAT-SMOKE.md](./UAT-SMOKE.md) § Platform

Platform client: `@era/satellite-kit` via `src/integration/control-plane-platform.client.ts`.

## Platform session (v1.0)

- [x] Platform session (`financeRole` + org) via SSO — `PlatformSessionBarServer`, executive `canViewExecutive`
- [x] Local operational RBAC (cashier roles) — unchanged
- [x] No local join-org / memberships (N/A — Finance/Orch only)

## Operations (v1.0)

- [x] R2/R3 presets, void/return/shift-close
- [x] Executive `/executive` with `canViewExecutive`
- [x] Settings UI playbook pilot `/settings` (ModalShell)

## Planned — v1.1

- [x] M14: Mobile stock / label check (WMS lite)
- [x] M15: Auto-replenishment / PO suggest (Finance)
- [x] M16: Supplier contracts & invoice match (Finance)

## Pre-GA

- [x] M8 offline UI — IndexedDB queue + `/pos` banner (`NEXT_PUBLIC_OFFLINE_QUEUE_ENABLED`)

## Planned — v2.0

- [x] M8: Offline queue
- [x] M9: KKM integration
- [x] M10: Umico/Kaspi sync
