# Hospitality ↔ Finance boundary (Nafta)

**Principle:** Hotel PMS and F&B POS own **guest-facing operations**. **era-finance-core** owns **accounting documents, GL, purchases, and warehouse** for the organization.

This replaces the Elektraweb pattern where ACC screens mixed operational folio with ERP. Nafta runs **ERA Finance** instead of 1C for GL; hotel screens **read and hand off**, not duplicate.

## Responsibility matrix

| Capability | Owner | Hotel / fb-pos role |
|------------|-------|---------------------|
| Folio charges & payments | Hotel PMS | Full CRUD — operational cash desk |
| Night audit (operational day) | Hotel PMS | Close business day; emit `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` unless Elektraweb still owns the day |
| Revenue → GL mapping | Hotel config → Finance journal | Admin `/admin/integration`; Finance posts NAS |
| **Sales invoices (e-qaimə / AR)** | **Finance** `/sales/invoices` | Operational list `/reports/invoices`; flag `integrateToAccounting`; **deep link** to Finance |
| **Agency city ledger / CL (ops)** | **Hotel** folios + snapshot + checkout transfer-to-AR (P5 H-BL-40) | Routing, credit gate, `PENDING_AR`/`TRANSFERRED_AR` handoff; snapshot `/reports/agency-ledger`. EW Agency Statement cutover → hotel `agency-statement` import (AGENCY folio remaining), **not** Finance/1C AR |
| **Agency AR / aging / invoice matching** | **Finance** counterparty reconciliation | Deep link `/crm/counterparties`; bank apply / matching (**H-BL-48**) — not duplicated in PMS |
| **Purchases / PO** | **Finance** `/purchases` | Not implemented in hotel (Wave 6+) |
| **Inventory / stock** | **Finance** `/inventory/*` | Housekeeping chemicals and linen are a zero-price day-document line (`/hk/consumption`). Local `/admin/stock` is not that warehouse balance. Minibar stays a guest folio sale. **Deep link** to Finance warehouse. Clinic procedure TTK write-off: [clinic-procedure-consumable-ttk.md](./adr/clinic-procedure-consumable-ttk.md) via `SATELLITE_CLINIC_PROCEDURE_COMPLETED` → `adjustStock` (warn+post) for a standalone clinic. Not hotel `/admin/stock`, not retail POS. |
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

## Nafta catalog

For a Nafta department (`revenueRouting=PARENT`), nomenclature and recipes are Finance `Product` and `ProductRecipe` of the hotel parent organization. The revenue account lives on the SKU card (`Product.revenueAccountCode`, NAS, type REVENUE). The department satellite reads that parent catalog. A service SKU may be the finished product of a recipe; components stay goods. The day document reads `revenueAccountCode` and explodes the recipe. Clinic no longer posts that procedure stock itself when revenue routes to the hotel.

Night audit posts one day document for the hotel organization. Folio lines for that business date, paid front-cash lines for the same cashier day, and housekeeping consumption for that business day become sale lines (`sku`, quantity, amount). Amount may be 0 or negative. Lines without a sku stay in `revenueLines`. Revenue for a sku line is `Product.revenueAccountCode`. A zero amount does not credit revenue. Cash, card, deposit, and city ledger are separate debits. The unpaid folio remainder is accounts receivable. Deposit above the day's revenue is an advance. The journal reference is `hotel-na:{date}`; repeating the day does not post again. Each sku with a recipe writes its components off the hotel warehouse, including a zero price. A good with no recipe is written off itself. A service with no recipe does not move stock. A negative line reverses revenue and stock.

Housekeeping consumption is that zero-price line: a Finance sku and a quantity for the open business day. It is not a guest folio charge and not a front-cash pending line. The hotel does not store the component norm; the Finance recipe does. An empty consumption day does not block the document. The linen schedule (`linenEveryNights`) stays an operational job and does not create the line. Minibar remains a guest sale on the folio. A line on a closed day, including an earlier one, is reversed by a negative quantity on the open day. The same sku from several closed days nets into one open line.

Night audit still closes the hotel day and advances the date when Finance refuses the document. The refusal is a warning on the night-audit screen and a rejected row in Finance at `/inventory/day-documents`. The accountant fixes the product card or the warehouse and posts that same `hotel-na:{date}`. A sku that is not in the hotel catalog is a refusal even when the amount is 0. Receipts and opening stock are the Finance purchase and warehouse receipt, not a hotel screen.

A Nafta department (`revenueRouting=PARENT` or hotel Front Cash) does not send its own revenue or stock events. Clinic visit, procedure, lab, and ward-day events stop. F&B sale, stock consumption, and shift close stop. Retail sale stops, and a return is a negative hotel cashier line. A standalone company with its own cashier still sends sale events. Checkout no longer posts a second revenue journal. The hotel invoice and the city-ledger snapshot stay receivables.

The hotel event gateway defaults to `orchestrator` (`ERA_EVENT_GATEWAY_MODE`). Checkout, night audit, invoice, and city-ledger snapshots go to `POST /api/v1/satellite-events`. While `ElektrawebBridgePolicy.inboundEnabled` is true for the organization, night audit still closes the business day locally and does not publish the day document. Outbound URL flags do not turn that publish on or off. The next ERA close after inbound is switched off is the one that enters the Finance queue.

## Events (orchestrator → Finance)

| Event | Status | Effect |
|-------|--------|--------|
| `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` | **Live** | One NAS day document: sku sale lines, tender split, recipe write-off |
| `SATELLITE_HOTEL_INVOICE_ISSUED` | **Live** | Draft sales invoice in Finance via orchestrator satellite-events |
| `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT` | **Live** (snapshot persisted) | Agency balance snapshot stored in Finance `AgencyCityLedgerSnapshot`; counterparty read when linked |
| fb-pos consumption (E8) | **Live** for a standalone cashier | `SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED` → WIP/COGS journal. A Nafta department skips it |
| fb-pos standalone sale | **Live** for a standalone cashier | `SATELLITE_FB_SALE_COMPLETED` on LOCAL_CASHIER pay. A Nafta department skips it |
| fb-pos shift closed | **Live** (stub) for a standalone cashier | `SATELLITE_FB_SHIFT_CLOSED`. A Nafta department skips it |

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
