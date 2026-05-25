# Preset: grocery

**Benchmark:** LS Retail / GK Retail (grocery), IVend (CIS).

## PRD modules

M6a — см. [PRD §4](../../PRD.md).

## Functional requirements (R2)

- PLU / barcode scan-first search
- Weighted items: quantity from scale (manual entry v1)
- Hotkeys for top PLU
- Simple line discount (supervisor role)
- Receipt metadata: `preset=grocery`

## Data on receipt line (planned)

| Field | Required |
|-------|----------|
| sku / plu | yes |
| quantity | yes |
| unitPrice | yes |
| isWeighted | optional |

## Not in v1

- Loyalty card engine
- Complex promo stacking
