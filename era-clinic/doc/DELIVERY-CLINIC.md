# DELIVERY-CLINIC

PRD: [../PRD.md](../PRD.md)

## K0 (done)

- [x] PRD v1.1, scaffold, SSO, `/appointments` placeholder

## K1 — MVP приём

- [ ] Patient ref + practitioner + room
- [ ] Schedule + check-in (K-01, K-02)
- [ ] Visit services + close → `SATELLITE_CLINIC_VISIT_COMPLETED` E2E

## K2 — Лаборатория

- [ ] LabOrder model + statuses ORDERED → PUBLISHED
- [ ] K-06…K-11 UI (order, collect, result import)
- [ ] `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` in `@era/contracts` + finance worker

## K3

- [ ] Discount audit (K-13), executive dashboard (K-14)
- [ ] Multi-room schedule

## K4

- [ ] LIS file import stub
- [ ] Patient portal (deferred module M8)
