# Landed cost allocation from BGD (Wave 5)

## Status

Accepted — customs charges allocated to SKU unit cost and inventory batches.

## Context

Before Wave 5, `customs.service.attach` posted a summary Dr 201/241 Cr 531 entry without per-SKU unit cost. Physical receipts wrote `StockMovement.price: 0`, breaking AVCO/FIFO valuation for imports.

## Decision

### Allocation engine

`LandedCostService.allocate(organizationId, declarationId, method)`:

- **Charge pool:** declaration `feesAzn` + sum of line `calculatedDutyAzn` + `calculatedExciseAzn`
- **Methods:** `STAT_VALUE` (default), `WEIGHT`, `QUANTITY`
- **Basis:** per-line statistical value AZN, net weight, or quantity respectively
- **Output:** per-item `unitLandedCost`, `InventoryBatch` row, updated `StockMovement.price` where linked

### Product linkage

- `PATCH /api/customs/declarations/:id/items/:itemId/product` binds BGD line → catalog `Product`
- Required before allocation when lines lack product mapping

### GL interaction

- Summary BGD attach postings remain for payable customs liability
- Landed cost updates inventory valuation layers; COGS on subsequent issue uses updated unit cost via existing `computeIssueUnitCost`

### Import pipeline

`ImportPipelineService` invokes allocate as final step when declaration id is supplied.

## API

| Route | Module |
|-------|--------|
| `POST /api/customs/declarations/:id/allocate-landed-cost` | `trade_pro` |
| Body: `{ method?: "STAT_VALUE" \| "WEIGHT" \| "QUANTITY" }` | |

UI: `/customs/[id]` — allocate action after product links.

## Consequences

- Default method **STAT_VALUE** matches MLSA statistical value practice; org can override per run
- Batch id returned per line for future subconto/lot traceability (Wave 3 alignment)
- Physical receipt still quantity-first; landed cost backfills movement price on attach

## Non-goals (Wave 5)

- Automatic receipt creation from purchase (manual `/inventory/receipts` flow unchanged)
- Official DVX XML round-trip for BGD

## Related

- [trade-context-daxili-xarici.md](./trade-context-daxili-xarici.md)
- COVERAGE FIN-LANDED-* · DELIVERY-FINANCE Platform
