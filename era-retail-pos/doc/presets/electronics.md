# Preset: electronics

**Benchmark:** Square POS + serial, Cin7 POS (serial tracking).

## PRD modules

M6c — см. [PRD §4](../../PRD.md).

## Functional requirements (R2)

- Serial / IMEI capture on sale for tracked SKUs
- Warranty registration stub (customer phone — no MDM)
- High-value line supervisor confirm (optional threshold)

## Data on receipt line (planned)

| Field | Required |
|-------|----------|
| sku | yes |
| serial | required when `sku.requiresSerial` |
| quantity | usually 1 |
