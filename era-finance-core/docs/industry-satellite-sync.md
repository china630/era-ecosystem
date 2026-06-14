# Industry Solutions ↔ ERA satellites sync

Finance **Industry Solutions** (painted-door + entitlements) maps to live umbrella satellites. Counterparty MDM, GL, sales invoices, purchases, inventory, and WhatsApp invoice delivery stay in **era-finance-core**.

## Matrix

| EarlyAccess key | Entitlement slug | Satellite app | Public host | Finance env (web) |
|-----------------|------------------|---------------|-------------|-------------------|
| RETAIL_ECOM | `industry_retail` | era-retail-pos | retail-pos.era-365.online | `NEXT_PUBLIC_SATELLITE_RETAIL_URL` |
| LOGISTICS_CUSTOMS | `industry_logistics` | era-logistics | logistics.era-365.online | `NEXT_PUBLIC_SATELLITE_LOGISTICS_URL` |
| CONSTRUCTION | `industry_construction` | era-construction | construction.era-365.online | `NEXT_PUBLIC_SATELLITE_CONSTRUCTION_URL` |
| CRM_WHATSAPP | `industry_crm` | era-crm | crm.era-365.online | `NEXT_PUBLIC_SATELLITE_CRM_URL` |
| AUTO_STO | `industry_auto_service` | era-auto-service | auto-service.era-365.online | `NEXT_PUBLIC_SATELLITE_AUTO_URL` |
| CLINIC | `industry_clinic` | era-clinic | clinic.era-365.online | `NEXT_PUBLIC_SATELLITE_CLINIC_URL` |
| WHOLESALE | `industry_wholesale` | era-wholesale | wholesale.era-365.online | `NEXT_PUBLIC_SATELLITE_WHOLESALE_URL` |
| HOTEL_PMS | `industry_hotel_pms` | era-hotel-pms | hotel-pms.era-365.online | `NEXT_PUBLIC_SATELLITE_HOTEL_URL` |
| FB_POS | `industry_fnb_pos` | era-fnb-pos | fnb-pos.era-365.online | `NEXT_PUBLIC_SATELLITE_FNB_POS_URL` |

## Hospitality Nafta boundary

Hotel and F&B POS are **Industry Solutions** tiles like the other verticals. Operational screens stay in the satellite; **source of truth** for accounting documents:

| Domain | Finance (source of truth) | Hotel / fb-pos (read / sync) |
|--------|---------------------------|------------------------------|
| Sales invoices | `/sales/invoices` | `/reports/invoices` — operational list + `integrateToAccounting` flag + deep link |
| Agency receivables | `/crm/counterparties/[id]/reconciliation` + `AgencyCityLedgerSnapshot` history | `/reports/agency-ledger` — city ledger snapshot; event `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT` persisted in Finance |
| Purchases | `/purchases` | — (hotel does not duplicate PO) |
| Inventory / stock | `/inventory/*` | `/admin/stock` — local MVP movements only; link to Finance warehouse |
| GL / NAS | Night audit worker, journal entries | Revenue GL mapping on `/admin/integration` |

See [HOSPITALITY_FINANCE_BOUNDARY.md](../../docs/HOSPITALITY_FINANCE_BOUNDARY.md) for the full split.

## Event bus

Satellites emit typed events → orchestrator → finance `SatelliteEventWorker` → `SatelliteEventDispatchService` (GL + draft invoices). Idempotency: `satellite_events_processed` by `(organizationId, correlationId)`.

**Billing & entitlements:** **era-orchestrator** is SoT — [CONTROL_PLANE_ARCHITECTURE.md](../../docs/CONTROL_PLANE_ARCHITECTURE.md) · [CP-BILLING-MIGRATION.md](../../docs/CP-BILLING-MIGRATION.md).

Hotel night audit (`SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED`): mapped `revenueLines` post multi-line NAS journal (cash + receivable debits, revenue credits per GL account).

**Live** in Finance dispatch: `SATELLITE_HOTEL_INVOICE_ISSUED`, `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT` (persisted to `agency_city_ledger_snapshots`) — [INTEGRATION_SSO_EVENTS.md](../../docs/INTEGRATION_SSO_EVENTS.md).

## CRM boundary

`CRM_WHATSAPP` painted-door / field satellite = **pre-sale** (leads, visits). Finance CRM = counterparty MDM; WhatsApp **invoice** delivery = Finance only.
