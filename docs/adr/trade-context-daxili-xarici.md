# Trade context: Daxili / Xarici / Import (Wave 5)

## Status

Accepted — explicit `TradeContext` on sales and purchase documents replaces the lone `isInternational` flag.

## Context

PRD §4.4.2 requires branching domestic e-qaimə workflows from export/import trade. Wave 4 shipped OCR, BGD, and Commercial Invoice PDF behind `isInternational`. Wave 5 G9 adds a first-class enum, Incoterms, export declaration reference, FX revenue policy hooks, and a stub import pipeline.

## Decision

### Enum

Prisma `TradeContext`:

| Value | AZ product term | Meaning |
|-------|-----------------|--------|
| `DOMESTIC` | Daxili | Local sale/purchase; domestic e-qaimé rules apply |
| `EXPORT` | Xarici (ixrac) | Export sale; no mandatory domestic e-qaimé block |
| `IMPORT` | İdxal | Import purchase; BGD + landed cost path |

Legacy `Invoice.isInternational` is derived: `tradeContext !== DOMESTIC`.

### Invoice fields

- `tradeContext`, `incoterms`, `exportDeclarationRef`, `destinationCountry`
- `InvoicesService.resolveTrade()` maps DTO → persisted context on create/patch
- Commercial Invoice PDF (`invoice-pdf.render.ts`) renders multilingual trade blocks for EXPORT/IMPORT

### Import pipeline

`ImportPipelineService.run(organizationId, ocrJobId, customsDeclarationId?, method?)`:

1. OCR job → structured prefill (`ForeignInvoicePrefillSchema`)
2. Draft purchase transaction (`TradeContext.IMPORT`)
3. Optional BGD link
4. `LandedCostService.allocate()` when declaration has linked products

API: `POST /api/customs/import-pipeline` — `@RequiresModule(trade_pro)`.

### Export policy

- EXPORT invoices skip mandatory e-qaimé validation gate (domestic VAT invoice is not the primary artifact)
- Optional `exportDeclarationRef` for audit traceability
- Revenue still posts in AZN using existing `fxRateToAzn` on the invoice

## Consequences

- UI: trade context selector on `/sales/invoices` create/edit; customs sidebar for import orgs
- Purchases inherit `IMPORT` when created from OCR/import pipeline
- Export e-qaimé remains optional / future S2S — not a Wave 5 blocker
- `@RequiresModule(trade_pro)` on customs landed-cost and import-pipeline routes

## Non-goals (Wave 5)

- Mandatory export e-qaimé S2S
- Full non-resident e-invoice automation for services (Qeyri-rezidentin e-qaiməsi) — seam only

## Related

- [landed-cost-allocation.md](./landed-cost-allocation.md)
- PRD §4.4.2 · DELIVERY-FINANCE M4 · COVERAGE FIN-TRADE-*
