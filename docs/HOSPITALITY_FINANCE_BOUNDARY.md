# Hospitality ↔ Finance boundary (Nafta)

**Principle:** Hotel PMS and F&B POS own **guest-facing operations**. **era-finance-core** owns **accounting documents, GL, purchases, and warehouse** for the organization.

This replaces the Elektraweb pattern where ACC screens mixed operational folio with ERP. Nafta runs **ERA Finance** instead of 1C for GL; hotel screens **read and hand off**, not duplicate.

## Responsibility matrix

| Capability | Owner | Hotel / fb-pos role |
|------------|-------|---------------------|
| Folio charges & payments | Hotel PMS | Full CRUD — operational cash desk |
| Night audit (operational day) | Hotel PMS | Close business day; emit `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` |
| Revenue → GL mapping | Hotel config → Finance journal | Admin `/admin/integration`; Finance posts NAS |
| **Sales invoices (e-qaimə / AR)** | **Finance** `/sales/invoices` | Operational list `/reports/invoices`; flag `integrateToAccounting`; **deep link** to Finance |
| **Agency city ledger / CL (ops)** | **Hotel** folios + snapshot + checkout transfer-to-AR (P5 H-BL-40) | Routing, credit gate, `PENDING_AR`/`TRANSFERRED_AR` handoff; snapshot `/reports/agency-ledger`. EW Agency Statement cutover → hotel `agency-statement` import (AGENCY folio remaining), **not** Finance/1C AR |
| **Agency AR / aging / invoice matching** | **Finance** counterparty reconciliation | Deep link `/crm/counterparties`; bank apply / matching (**H-BL-48**) — not duplicated in PMS |
| **Purchases / PO** | **Finance** `/purchases` | Not implemented in hotel (Wave 6+) |
| **Inventory / stock** | **Finance** `/inventory/*` | Local MVP `/admin/stock` for HK/consumption only; **deep link** to Finance warehouse. Clinic procedure TTK write-off: [clinic-procedure-consumable-ttk.md](./adr/clinic-procedure-consumable-ttk.md) via `SATELLITE_CLINIC_PROCEDURE_COMPLETED` → `adjustStock` (warn+post). Not hotel `/admin/stock`, not retail POS. |
| POS tickets, KDS, shifts | fb-pos | Full CRUD; room charge → hotel bridge |
| Banquet BEO | Hotel + fb-pos | Hotel confirms BEO; fb-pos outlet `BANQUET` |
| Fiscal KKM (guest receipt) | fb-pos / hotel folio | Stub today; real NBC/Cybernet Wave 6+ |

## Deep links (hotel web)

Configure in `era-hotel-pms/.env`:

```env
NEXT_PUBLIC_FINANCE_WEB_URL="http://localhost:3000"
```

| Hotel screen | Finance destination |
|--------------|---------------------|
| `/reports/invoices` | `/sales/invoices` |
| `/reports/agency-ledger` | `/crm/counterparties` (pick agency → reconciliation) |
| `/admin/stock` | `/inventory` |

Banner component: `FinanceBoundaryBanner` — shows when `NEXT_PUBLIC_FINANCE_WEB_URL` is set.

## Events (orchestrator → Finance)

| Event | Status | Effect |
|-------|--------|--------|
| `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` | **Live** (Wave 5) | Multi-line NAS journal from `revenueLines` + GL map |
| `SATELLITE_HOTEL_INVOICE_ISSUED` | **Live** | Draft sales invoice in Finance via orchestrator satellite-events |
| `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT` | **Live** (snapshot persisted) | Agency balance snapshot stored in Finance `AgencyCityLedgerSnapshot`; counterparty read when linked |
| fb-pos consumption (E8) | **Live** | `SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED` → WIP/COGS journal |
| fb-pos standalone sale | **Live** | `SATELLITE_FB_SALE_COMPLETED` on LOCAL_CASHIER pay → revenue journal (not for room-charge/hub) |
| fb-pos shift closed | **Live** (stub) | `SATELLITE_FB_SHIFT_CLOSED` — cash recon log meta |

## What hotel keeps locally

- `FiscalDocument` — operational invoice register before ERP handoff
- `integrateToAccounting` — per-document flag for export queue
- Agency ledger **operational** totals (opening, charges, payments, city ledger) — not GL aging
- Folio money close (settle, deposits, refunds, checkout gates) — see [ADR hotel-city-ledger-and-fo-money](./adr/hotel-city-ledger-and-fo-money.md)
- Planned folio AR phases at checkout: `PENDING_AR` / `TRANSFERRED_AR` (P5) before Finance Paid

## FO money / City Ledger backlog (P5)

| ID | Theme | Owner |
|----|-------|-------|
| H-BL-40 | Transfer to CL at checkout + credit/contract gate | hotel-pms |
| H-BL-41 | Deposit at settle/checkout | hotel-pms |
| H-BL-42 | Folio payment refunds | hotel-pms |
| H-BL-43 | Checkout discounts | hotel-pms |
| H-BL-44 | Night Audit polish | hotel-pms |
| H-BL-45 | Per-guest folio close | hotel-pms |
| H-BL-46 | Agency prepaid/postpaid settlement | hotel + Finance |
| H-BL-47 | Table filter enrichment | hotel-pms |
| H-BL-48 | Terms / aging / invoice matching | **Finance** |

Coverage rows: `HOT-CASH-*`, `HOT-CL-*`, `HOT-CO-*`, `HOT-NA-*` in [COVERAGE_MATRIX.md](./COVERAGE_MATRIX.md).

## References

- [era-hotel-pms/doc/clone-spec/01-finance-boundary.md](../era-hotel-pms/doc/clone-spec/01-finance-boundary.md)
- [era-finance-core/docs/industry-satellite-sync.md](../era-finance-core/docs/industry-satellite-sync.md)
- [docs/MODULES_CATALOG.md](./MODULES_CATALOG.md)
- [docs/adr/hotel-city-ledger-and-fo-money.md](./adr/hotel-city-ledger-and-fo-money.md)
