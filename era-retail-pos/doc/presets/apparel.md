# Preset: apparel

**Benchmark:** Lightspeed Retail (variants), Vend.

## PRD modules

M6b — см. [PRD §4](../../PRD.md).

## Functional requirements (R2)

- Variant dimensions: size, color (config per SKU class)
- Return by original receipt id (R-12)
- Optional: employee sales attribution

## Data on receipt line (planned)

| Field | Required |
|-------|----------|
| sku | yes |
| variantId or size/color | yes for variant SKUs |
| quantity | yes (often 1) |
