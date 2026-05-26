# Industry Solutions ↔ ERA satellites sync

Finance **Industry Solutions** (painted-door + entitlements) maps to live umbrella satellites. Counterparty MDM, GL, sales invoices, purchases, inventory, and WhatsApp invoice delivery stay in **era-finance-core**.

## Matrix

| EarlyAccess key | Entitlement slug | Satellite app | Public host | Finance env (web) |
|-----------------|------------------|---------------|-------------|-------------------|
| RETAIL_ECOM | `industry_retail_ecom` | era-retail-pos | retail.era.az | `NEXT_PUBLIC_SATELLITE_RETAIL_URL` |
| LOGISTICS_CUSTOMS | `industry_logistics_customs` | era-logistics | logistics.era.az | `NEXT_PUBLIC_SATELLITE_LOGISTICS_URL` |
| CONSTRUCTION | `industry_construction` | era-construction | construction.era.az | `NEXT_PUBLIC_SATELLITE_CONSTRUCTION_URL` |
| CRM_WHATSAPP | `industry_crm_whatsapp` | era-crm-field | crm.era.az | `NEXT_PUBLIC_SATELLITE_CRM_URL` |
| AUTO_STO | `industry_auto_sto` | era-auto-sto | auto.era.az | `NEXT_PUBLIC_SATELLITE_AUTO_URL` |
| CLINIC | `industry_clinic` | era-clinic | clinic.era.az | `NEXT_PUBLIC_SATELLITE_CLINIC_URL` |
| WHOLESALE | `industry_wholesale` | era-wholesale | wholesale.era.az | `NEXT_PUBLIC_SATELLITE_WHOLESALE_URL` |
| HOTEL_PMS | `industry_hotel_pms` | era-hotel-pms | hotel.era.az | `NEXT_PUBLIC_SATELLITE_HOTEL_URL` |
| FB_POS | `industry_fb_pos` | era-fb-pos | fb.era.az | `NEXT_PUBLIC_SATELLITE_FB_POS_URL` |

## Hospitality Nafta boundary

Hotel and F&B POS are **Industry Solutions** tiles like the other verticals. Operational screens stay in the satellite; **source of truth** for accounting documents:

| Domain | Finance (source of truth) | Hotel / fb-pos (read / sync) |
|--------|---------------------------|------------------------------|
| Sales invoices | `/sales/invoices` | `/reports/invoices` — operational list + `integrateToAccounting` flag + deep link |
| Agency receivables | `/crm/counterparties/[id]/reconciliation` | `/reports/agency-ledger` — city ledger snapshot |
| Purchases | `/purchases` | — (hotel does not duplicate PO) |
| Inventory / stock | `/inventory/*` | `/admin/stock` — local MVP movements only; link to Finance warehouse |
| GL / NAS | Night audit worker, journal entries | Revenue GL mapping on `/admin/integration` |

See [HOSPITALITY_FINANCE_BOUNDARY.md](../../docs/HOSPITALITY_FINANCE_BOUNDARY.md) for the full split.

## Event bus

Satellites emit typed events → orchestrator → finance `SatelliteEventWorker` → `SatelliteEventDispatchService` (GL + draft invoices). Idempotency: `satellite_events_processed` by `(organizationId, correlationId)`.

**Billing & entitlements** are migrating to **era-365-orchestrator** — see [CONTROL_PLANE_ARCHITECTURE.md](../../docs/CONTROL_PLANE_ARCHITECTURE.md).

Hotel night audit (`SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED`, Wave 5 FIN-01): mapped `revenueLines` post multi-line NAS journal (cash + receivable debits, revenue credits per GL account).

**Live** in Finance dispatch (Wave 5 / H-P0): `SATELLITE_HOTEL_INVOICE_ISSUED`, `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT` (see [INTEGRATION_SSO_EVENTS.md](../../docs/INTEGRATION_SSO_EVENTS.md)).

## CRM boundary

`CRM_WHATSAPP` painted-door / field satellite = **pre-sale** (leads, visits). Finance CRM = counterparty MDM; WhatsApp **invoice** delivery = Finance only.
