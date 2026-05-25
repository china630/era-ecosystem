# UAT smoke — era-retail-pos

## R0 — Platform

- [x] `GET /api/health` → 200
- [x] Home page loads
- [x] `POST /api/events/dispatch` (with orchestrator running)

## R1 — MVP checkout

- [ ] Open shift: `POST /api/shifts/open` → shift id, status OPEN
- [ ] Create receipt: `POST /api/receipts` with shiftId + lines → receipt OPEN
- [ ] Pay receipt: `POST /api/receipts/{id}/pay` → status PAID + orchestrator receives `SATELLITE_RETAIL_SALE_COMPLETED`
- [ ] Close shift: `POST /api/shifts/close` with shiftId → status CLOSED
- [ ] `/pos` UI: open shift → add line → pay → success message
