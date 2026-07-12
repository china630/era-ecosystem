# Goskomstat statistical forms engine (Wave 5)

## Status

Accepted — configurable generator with placeholder standard set; official blank verification pending.

## Context

MHBS **financial** statements (Wave 4 G2) are separate from **statistical** reporting to Goskomstat. Wave 5 G3 adds a catalog-driven engine analogous to `TaxExportService` + `report-export.util.ts`.

## Decision

### Models

- `StatReportDefinition` — code, name, `periodKind` (MONTH/QUARTER/YEAR), version, `mappingJson`
- `StatReportExport` — generated file metadata, period, status, storage key

### Catalog

- **Source:** `era-finance-core/packages/database/prisma/catalog/national/stat-report-definitions.v1.json`
- **Seed:** `upsertStatReportDefinitions()` on module init when table empty
- **Standard placeholder set:**
  - `AZ_STAT_1_MUESSISE` — 1-müəssisə (annual enterprise)
  - `AZ_STAT_LABOR` — workforce
  - `AZ_STAT_PRODUCTION` — production/output
  - `AZ_STAT_PRICES` — price observation

Each `mappingJson.sections[]` row maps `lineCode` → source metric (`gl.turnover`, `hr.headcount`, `inventory.issue`, `priceList`, etc.).

### Generator

`StatformsService.generate()`:

1. Resolve period range from `periodKind` + period string
2. Evaluate mapping sections (GL prefixes, HR aggregates, inventory/manufacturing metrics)
3. Build XLSX via `statReportXlsxBuffer()` in `report-export.util.ts`
4. Persist export row + upload to `StorageService`

### API and UI

| Route | Purpose |
|-------|---------|
| `GET /api/reporting/statforms/definitions` | Active form catalog |
| `GET /api/reporting/statforms/exports` | Org export history |
| `POST /api/reporting/statforms/generate` | Generate XLSX |
| `GET /api/reporting/statforms/exports/:id/download` | Download file |

Web: **`/reporting/statforms`** — list, generate, download.

### Entitlement

`StatformsService.assertAccess()` requires **`compliance_pro`** or **`tax_pro`** (super-admin bypass). Not gated by `@RequiresModule` decorator — checked in service for dual-module OR.

## Consequences

- Placeholder mappings are **not** filing-ready until official Goskomstat line layouts are imported into catalog JSON (version bump)
- Separate from MHBS `/reports/statements/*` and tax-export declarations
- i18n keys under `reporting.statforms.*`

## Non-goals (Wave 5)

- Direct Goskomstat portal S2S upload
- PDF replica of every official blank

## Related

- [mhbs-statement-mapping.md](./mhbs-statement-mapping.md) — financial vs statistical boundary
- COVERAGE FIN-STAT-* · DELIVERY-FINANCE M7
