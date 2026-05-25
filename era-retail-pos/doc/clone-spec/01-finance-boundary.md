# Finance boundary — ERA Retail POS

## Always in era-finance-core

| Domain | Examples |
|--------|----------|
| Product MDM | SKU, barcode, UoM, categories, prices (list) |
| Inventory | Warehouses, movements, FIFO, stock take |
| GL / NAS | Sales revenue, COGS, VAT accounts |
| Counterparty | Buyer legal entity, VÖEN |
| Invoicing | Tax invoice, PDF, numbering |
| WhatsApp | **Invoice delivery** to customer (not POS chat) |

## In era-retail-pos

| Domain | Examples |
|--------|----------|
| Shift & register | Open/close, cashier binding |
| Receipt | Lines, payments, preset-specific fields |
| Event emission | `SATELLITE_RETAIL_SALE_COMPLETED` with `correlationId` = receipt id |

## Handoff contract

On receipt **PAID**:

1. Build event per [retail.events.ts](../../../packages/era-contracts/src/events/retail.events.ts)
2. `POST /api/events/dispatch` or orchestrator gateway
3. Finance `SatelliteEventDispatchService.handleRetailSale`:
   - Journal (default 201 / 601, env-overridable)
   - Draft invoice if counterparty resolvable

## Anti-patterns

- Do not store `organizationId` product catalog as source of truth
- Do not post journals from Next.js API routes in satellite
- Do not create Counterparty rows from POS without Finance MDM rules
