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

- [ ] grocery: PLU / weighted line (R-06)
- [ ] apparel: variant line (R-07)
- [ ] electronics: serial line (R-08)
- [ ] pharmacy: OTC + Rx gate (R-09, R-10)

## R3 — Returns & shift event

- [ ] Void line (R-11)
- [ ] Return receipt (R-12)
- [x] `SATELLITE_RETAIL_SHIFT_CLOSED` in @era/contracts
- [ ] Shift close dispatch

## R4 — Deferred

- [ ] Offline queue (M8)
- [ ] KKM integration (M9)
- [ ] Umico/Kaspi sync (M10)
