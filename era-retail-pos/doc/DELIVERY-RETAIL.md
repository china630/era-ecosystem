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

## R4 — Deferred

- [ ] Offline queue (M8)
- [ ] KKM integration (M9)
- [ ] Umico/Kaspi sync (M10)

Platform add-ons (booking, notifications, portal, payments): `src/integration/control-plane-platform.client.ts` → `CONTROL_PLANE_URL` (era-365-orchestrator).
