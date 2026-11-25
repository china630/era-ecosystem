# ADR: Clinic procedure TTK (consumable BOM) → Finance inventory

**Status:** Accepted — 2026-08-21 (W1 BOM + W2 Finance write-off)  
**Scope:** `era-clinic` procedure catalog + `era-finance-core` warehouse. Not retail POS. Not pharmacy.

Related: [satellite-finance-bridge-pattern.md](./satellite-finance-bridge-pattern.md) · [HOSPITALITY_FINANCE_BOUNDARY.md](../HOSPITALITY_FINANCE_BOUNDARY.md) · [sanatorium-vnext.md](./sanatorium-vnext.md) (SV12 split) · clinic `procedure-completion.service.ts`

## Context

Nafta sanatorium procedures consume **cabin TTK** from the **organization warehouse**, not from a guest-facing pharmacy till.

Pre-W1 `completeProcedureOrder` posted dummy `PROC-{procedureCode} × 1` toward retail stock write-off. Product decision (2026-08-21): pharmacy POS is **not connected**; procedure consumables must hit **Finance inventory**.

## Decision

### D1 — Clinic owns the TTK; Finance owns stock

| Layer | Owns |
|-------|------|
| `era-clinic` | `ProcedureConsumableLine` BOM on `ProcedureType` |
| `era-finance-core` | Product master, warehouse qty, write-off, COGS |
| `era-retail-pos` | Out of this contour |

On COMPLETED, clinic emits `SATELLITE_CLINIC_PROCEDURE_COMPLETED` with resolved TTK. `correlationId` = procedure order id.

### D2 — BOM shape

`ProcedureConsumableLine`: sku, optional financeProductId, qtyPerSession, wasteFactor. Empty BOM = no stock movement. SatAdmin ENTITY_REF via `GET /api/admin/finance-products`.

### D3 — Event / bridge

Retail HTTP stock-write-off **retired**. Tariff folio unchanged. TTK is cost, not guest folio.

### D4 — Shortage policy

**Warn + post** (allow negative stock). Do not block nurse COMPLETED. Unknown SKU: warn in meta + skip line.

### D5 — Waves

| Wave | Scope | Status |
|------|--------|--------|
| W0 | ADR + STUB | done |
| W1 | Schema + SatAdmin + stop PROC-* | **done** |
| W2 | Finance write-off | **done** |
| W3 | UAT → SHIPPED | pending |

## Out of scope

Retail pharmacy / Rx reserve; clinic-local inventory SoT; folio line per pad; hold/preauth.

## COVERAGE

`CLI-47` — **API** after W1 (not SHIPPED until UAT).
