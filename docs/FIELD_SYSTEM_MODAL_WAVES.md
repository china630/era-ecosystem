# Field system — modal migration waves (F)

Ordered migration of SatAdmin modal CRUD to `Field*` + explicit `preset`. See `DESIGN.md` Field width taxonomy.

Token layers (L1/L2/L3) + `resolveField` / `columnFilters`: [`docs/adr/era-design-tokens-3tier.md`](./adr/era-design-tokens-3tier.md).

## Wave status

| Wave | Apps | Modals | Status |
|------|------|--------|--------|
| **D** | era-hotel-pms | Reservation card (left panel + tabs) | Done |
| **F1** | era-hotel-pms | GuestCardLeftPanel, NewBookingModal, master-data (all modals) | Done |
| **F2** | era-fnb-pos, era-retail-pos | settings, MenuAdminPanel, daily-menu, supplier-match | Done |
| **F3** | era-logistics, era-construction | admin/settings, trips status modals, field-ops daily log | Done |
| **F4** | era-crm, era-auto-service, era-wholesale | leads, admin/import wizard, settings/WO/appointments, import-orders | Done |
| **F5** | era-clinic, era-bank | AppointmentCreateModal, patients/[id] edit, Cif/Payment/Account modals | Done |
| **F6** | era-finance-core | CreateCounterpartyModal, employee-modal | Done |
| **C** | era-clinic | Hex→L3 token sweep (admin, patient/lab, sanatorium, ops chrome, remainder); Field*/DatePicker on remaining modals | Done |

## Per-app priority (reference)

| App | Modal 1 | Modal 2 | Modal 3 |
|-----|---------|---------|---------|
| era-hotel-pms | GuestCardModal (left panel) | NewBookingModal | admin/master-data (all modals) |
| era-fnb-pos | MenuAdminPanel | admin/settings | admin/daily-menu |
| era-retail-pos | app/settings | admin/supplier-match | — |
| era-logistics | trips/[id] POD/fuel | admin/settings | — |
| era-construction | admin/settings | field-ops daily log | — |
| era-crm | leads create | admin/import wizard | admin/settings |
| era-auto-service | admin/settings | work-order intake | appointments |
| era-wholesale | admin/import-orders | — | — |
| era-clinic | AppointmentCreateModal | patients/[id] edit | admin/master-data (gaps only) |
| era-bank | CifModals | PaymentModals | AccountModals |
| era-finance-core | CreateCounterpartyModal | employee-modal | — |

**Excluded:** ops canvases (POS floor, KDS, chessboard, room rack) — full-viewport, not modal CRUD.

## Enforcement (post-F)

When `raw-input-no-token` total < 50, new files under `era-*/src/components/**` should use `Field*` (ops canvases allowlisted). Run `npm run lint:design-tokens` before merge; `--update-baseline` only when intentionally shrinking debt.

## Wave C — clinic 3-tier token rebuild

Ordered hex→L3 + Field* sweep for era-clinic (C1 SatAdmin → C2 Patient/Lab → C3 Sanatorium → C4 Ops canvases chrome → C5 remainder). Spec: [adr/era-design-tokens-3tier.md](./adr/era-design-tokens-3tier.md). Ops canvases keep layout; colors/buttons via kit. Baseline: `era-clinic` `raw-input-no-token` shrunk to 0 (lint scans `src/`; checkboxes use `MODAL_CHECKBOX_CLASS`).
