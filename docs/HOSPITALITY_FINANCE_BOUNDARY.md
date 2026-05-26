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
| **Agency city ledger / CL** | **Finance** counterparty reconciliation | Operational snapshot `/reports/agency-ledger`; **deep link** to `/crm/counterparties` |
| **Purchases / PO** | **Finance** `/purchases` | Not implemented in hotel (Wave 6+) |
| **Inventory / stock** | **Finance** `/inventory/*` | Local MVP `/admin/stock` for HK/consumption only; **deep link** to Finance warehouse |
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
| `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT` | **Live** | Reconciliation snapshot meta in Finance dispatch |
| City ledger snapshot | Planned | Agency balance sync for reconciliation |
| fb-pos consumption (E8) | Planned | Inventory movement in Finance |

## What hotel keeps locally

- `FiscalDocument` — operational invoice register before ERP handoff
- `integrateToAccounting` — per-document flag for export queue
- Agency ledger **operational** totals (opening, charges, payments, city ledger) — not GL aging

## References

- [era-hotel-pms/doc/clone-spec/01-finance-boundary.md](../era-hotel-pms/doc/clone-spec/01-finance-boundary.md)
- [era-finance-core/docs/industry-satellite-sync.md](../era-finance-core/docs/industry-satellite-sync.md)
- [docs/MODULES_CATALOG.md](./MODULES_CATALOG.md)
