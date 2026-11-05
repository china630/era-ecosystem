# ADR: Platform billing invoice line dimensions

**Status:** Accepted  
**Date:** 2026-11-03  
**Related:** [sku-grace-trial-7d.md](./sku-grace-trial-7d.md) · [commercial-outlet-registry.md](./commercial-outlet-registry.md) · [operator-finance-dogfood.md](./operator-finance-dogfood.md) · [era-commercial-catalog.md](./era-commercial-catalog.md)

## Context

`BillingInvoiceItem` stored free-text `description` + `amount`, so support could not prove which org, satellite, outlet, SKU, or rating basis produced a figure.

## Decision

Extend `BillingInvoiceItem` with structured dims:

- `organizationId`, optional `parentOrganizationId`
- `satelliteKey`, `outletCode` (nullable)
- `catalogKind`, `moduleKey` and/or `meterKey`
- `period` (`YYYY-MM` Baku)
- `ratingBasis`: `FULL_MONTH` | `GRACE` | `COVERED` | `SUSPENDED` | `METER` | `OTHER`
- `unitPrice`, `qty`, `amount`, `priceSnapshot`

Monthly run omits or zero-skips GRACE / COVERED / SUSPENDED scopes. UI groups Org -> Sat -> Outlet -> lines.

Human `description` remains a derived label, not the source of truth.

## Consequences

- Operator Finance dogfood maps lines via [operator-finance-dogfood.md](./operator-finance-dogfood.md).
- Owner and platform invoice screens must show the tree, not only a flat opaque total.
