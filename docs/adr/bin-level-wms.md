# Bin-level WMS and mobile scan (Wave 5)

## Status

Accepted — `BinBalance` model for per-cell quantities; mobile operator UI under `inventory` entitlement.

## Context

WMS-light (v95+) added `WarehouseBin` and optional `binId` on movements, but `StockItem` remained unique per `(org, warehouse, product)` — not per bin. Wave 5 E6 adds bin-level balances, zones, pick lists, and a mobile scan surface.

## Decision

### Bin balances

- New model **`BinBalance`**: `(organizationId, warehouseBinId, productId)` → `quantity`
- `BinBalanceService` maintains balances on WMS mutations; warehouse-level `StockItem` aggregate unchanged for backward-compatible reports
- Scan resolves bin by `WarehouseBin.barcode` or `code`

### Zones and picking

- `WarehouseZone` with `zoneType` (storage, picking, staging, etc.)
- Pick lists: create → confirm lines → issue from source bin

### Mobile API

Controller prefix **`/api/inventory/wms/*`** (`WmsMobileService`):

- `GET …/scan?barcode=` — bin lookup + on-hand lines
- `POST …/receive`, `…/issue`, `…/transfer`, `…/adjust` — bin-scoped movements
- Zones CRUD, bin balances list, pick list lifecycle

`@RequiresModule("inventory")` on `WmsController`.

### UI

- **`/inventory/wms-mobile`** — operator scan workflow (receive/issue/transfer/adjust/inventory)
- Existing topology UI for bin CRUD remains on inventory settings

## Consequences

- Physical inventory audits can target bin scope via mobile adjust (warehouse-wide audit unchanged)
- Manufacturing and invoice COGS still use warehouse-level costing; bin is logistics dimension
- Entitlement **`inventory`** required for WMS API (previously unguarded inventory routes partially gated in Wave 5)

## Non-goals (Wave 5)

- Hardware TSD vendor SDK integration (browser barcode input only)
- Full wave planning / route optimization

## Related

- PRD §4.10 · §6.7 M7 · COVERAGE FIN-WMS-*
