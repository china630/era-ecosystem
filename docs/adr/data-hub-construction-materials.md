# ADR: Data Hub construction materials catalog (sketch)

**Status:** Accepted (MVP landed 2026-11-20) — AC 🟡 until negatives+UAT deepen  
**Coverage:** Shared material nomenclature (+ optional indicative prices) in `era-data-hub`

**Related:**

- [reference-data-ecosystem.md](./reference-data-ecosystem.md) — hub SoR + industry via Platform Gateway
- [era-data-hub.md](./era-data-hub.md)
- [construction-smeta-rate-engine.md](./construction-smeta-rate-engine.md) — rates/norms reference hub codes
- [construction-domain-boundaries.md](./construction-domain-boundaries.md)

---

## Context

Construction, Finance inventory, and future purchasing need a **shared materials nomenclature**. Duplicating SKUs per satellite is costly. Data Hub already owns cross-tenant reference catalogs (FX, calendar, HS, UoM…).

This is **not** a DESN rate engine and **not** org year budget.

---

## Decision (sketch)

### D1 — Catalog in Data Hub

| Field (MVP sketch) | Notes |
|--------------------|--------|
| `code` | Stable SKU / ERP code |
| `nameAz` / `nameRu` / `nameEn` | i18n |
| `uomCode` | Link hub UoM |
| `hsCode` | Optional HS link |
| `classPath` | Optional taxonomy |
| `indicativePriceAzn` | Optional; **not** accounting truth |
| `version` / `effectiveFrom` | Content versioning |

API sketch: `GET /registry/v1/construction/materials` (hub) → Platform Gateway `GET /platform/v1/catalog/construction-materials` for industry (same pattern as other catalogs).

### D2 — Consumer rules

- Industry (Construction): **gateway only** (no direct hub from satellite).
- Finance: hub token or gateway per existing matrix; org may keep local price lists that **override** indicative hub price.
- Excel org copy: allowed as `referenceSource` sibling later; does not write shared hub.

### D3 — Billing

- Likely folded into `platform_reference_data` metered reads, or a thin add-on key when content is large — decide at seed time.

### D4 — Out of sketch

- Supplier contracts, stock balances, warehouse qty (Finance / Construction ops).
- Norms of consumption (rate engine).
- Auto PO creation.

---

## Consequences

- New hub tables + gateway route when wave opens.
- Construction rate engine and BOQ lines may store `materialCode` FK-by-code to hub.
- No COVERAGE SHIPPED / edition change from this sketch alone.

## References

[DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md)  
Plan: [`.cursor/plans/smeta-budget-materials-ecosystem.plan.md`](../../.cursor/plans/smeta-budget-materials-ecosystem.plan.md)
