# DELIVERY-CLINIC

PRD: [../PRD.md](../PRD.md)

## K0 (done)

- [x] PRD v1.1, scaffold, SSO, `/appointments` placeholder

## K1 — MVP приём

- [x] Patient ref + practitioner + room
- [x] Schedule + check-in (K-01, K-02)
- [x] Visit services + close → `SATELLITE_CLINIC_VISIT_COMPLETED` E2E

## K2 — Лаборатория

- [x] LabOrder model + statuses ORDERED → PUBLISHED
- [ ] K-06…K-11 UI (order, collect, result import)
- [x] `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` in `@era/contracts` + finance worker

## K3

- [ ] Discount audit (K-13), executive dashboard (K-14)
- [ ] Multi-room schedule

## K4

- [ ] LIS file import stub
- [ ] Patient portal (deferred module M8)
