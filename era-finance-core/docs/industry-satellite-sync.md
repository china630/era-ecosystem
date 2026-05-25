# Industry Solutions ↔ ERA satellites sync

Finance **Industry Solutions** (painted-door + entitlements) maps to live umbrella satellites. Counterparty MDM, GL, WhatsApp invoice delivery stay in **era-finance-core**.

## Matrix

| EarlyAccess key | Entitlement slug | Satellite app | Public host | Finance env (web) |
|-----------------|------------------|---------------|-------------|-------------------|
| RETAIL_ECOM | `industry_retail_ecom` | era-retail-pos | retail.era.az | `NEXT_PUBLIC_SATELLITE_RETAIL_URL` |
| LOGISTICS_CUSTOMS | `industry_logistics_customs` | era-logistics | logistics.era.az | `NEXT_PUBLIC_SATELLITE_LOGISTICS_URL` |
| CONSTRUCTION | `industry_construction` | era-construction | construction.era.az | `NEXT_PUBLIC_SATELLITE_CONSTRUCTION_URL` |
| CRM_WHATSAPP | `industry_crm_whatsapp` | era-crm-field | crm.era.az | `NEXT_PUBLIC_SATELLITE_CRM_URL` |
| AUTO_STO | `industry_auto_sto` | era-auto-sto | auto.era.az | `NEXT_PUBLIC_SATELLITE_AUTO_URL` |
| CLINIC | `industry_clinic` | era-clinic | clinic.era.az | `NEXT_PUBLIC_SATELLITE_CLINIC_URL` |
| WHOLESALE | `industry_wholesale` | era-wholesale | wholesale.era.az | `NEXT_PUBLIC_SATELLITE_WHOLESALE_URL |

## Not in Industry Solutions sidebar

| Product | Role |
|---------|------|
| era-hotel-pms | Standalone PMS (hotel.era.az) |
| era-fb-pos | F&B satellite bridged to hotel |

## Event bus

Satellites emit typed events → orchestrator → finance `SatelliteEventWorker` → `SatelliteEventDispatchService` (GL + draft invoices). Idempotency: `satellite_events_processed` by `(organizationId, correlationId)`.

## CRM boundary

`CRM_WHATSAPP` painted-door / field satellite = **pre-sale** (leads, visits). Finance CRM = counterparty MDM; WhatsApp **invoice** delivery = Finance only.
