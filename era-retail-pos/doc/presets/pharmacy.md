# Preset: pharmacy

**Benchmark:** PharmacyKeeper (OTC-first), RxWorks (Rx workflow).  
**Not a separate app** — preset on `Outlet.preset = pharmacy`.

## PRD modules

M6d — см. [PRD §4](../../PRD.md).

## Functional requirements (R2)

### OTC

- Standard checkout like grocery with batch/expiry **display** (from Finance cache)
- FEFO pick hint (operational only; stock logic in Finance)

### Rx (restricted)

- Pharmacist role required
- Rx id / prescription reference on line
- Audit log table in satellite (who dispensed, when)
- No WhatsApp invoice from satellite — Finance only

## Compliance

- Regulatory reporting (MHM AZ, etc.) — **DEFERRED**; coordinate with Finance compliance module

## Data on receipt line (planned)

| Field | OTC | Rx |
|-------|-----|-----|
| sku | yes | yes |
| batchId | optional | required |
| rxReference | — | required |
| quantity | yes | yes |
