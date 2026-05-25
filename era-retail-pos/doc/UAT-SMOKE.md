# UAT smoke — era-retail-pos

## R0 — Platform

- [x] `GET /api/health` → 200
- [x] Home page loads
- [x] `POST /api/events/dispatch` (with orchestrator running)

## R1 — MVP checkout

- [x] Open shift: `POST /api/shifts/open` → shift id, status OPEN
- [x] Create receipt: `POST /api/receipts` with shiftId + lines → receipt OPEN
- [x] Pay receipt: `POST /api/receipts/{id}/pay` → status PAID + orchestrator receives `SATELLITE_RETAIL_SALE_COMPLETED`
- [x] Close shift: `POST /api/shifts/close` with shiftId → status CLOSED
- [x] `/pos` UI: open shift → add line → pay → success message

## R2 — Presets

- [ ] Open shift with preset: `POST /api/shifts/open` body `{ "preset": "grocery" | "apparel" | "electronics" | "pharmacy" }` → outlet preset persisted
- [ ] `GET /api/presets` → config with `lineFields` per preset
- [ ] Grocery receipt: PLU + optional weighted line (`isWeighted`, `weightKg`) → 201
- [ ] Apparel receipt: size + color required → 400 if missing
- [ ] Electronics receipt: serial required → 400 if missing
- [ ] Pharmacy OTC: standard line without Rx gate
- [ ] Pharmacy Rx: `rxRequired` + `rxApprovedBy` + `batch` required → 400 without approval
- [ ] `/pos` UI: preset selector on shift open, dynamic line fields per preset

## R3 — Returns & shift event

- [ ] Void line: `POST /api/receipts/{id}/lines/{lineId}/void` on OPEN receipt → line `VOID`, `amountNet` recalculated (requires `SHIFT_SUPERVISOR` or `OUTLET_ADMIN`)
- [ ] Return receipt: `POST /api/receipts/{id}/return` on PAID receipt → negative return receipt with `originalReceiptId` + `SATELLITE_RETAIL_SALE_COMPLETED` (negative `amountNet`)
- [ ] Close shift: `POST /api/shifts/close` → `totalSales`, `receiptCount`, `SATELLITE_RETAIL_SHIFT_CLOSED`
- [ ] `/pos` UI: void line button, return on paid receipt, close shift with Z-summary
