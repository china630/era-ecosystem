# MHBS statutory statement line mapping (Wave 4)

## Status

Accepted — NAS trial balance → MoF line codes for official financial statement forms.

## Context

ERA Finance shipped management reports (trial balance, P&L, cash flow) in Waves 1–3 but not **statutory MHBS** forms with Ministry of Finance line codes required for filing. Wave 4 Block D adds a catalog-driven generator and export surfaces.

## Decision

### Catalog

- **Source file:** `packages/database/prisma/catalog/national/mhbs-statement-lines.v1.json`
- **Forms:** `BALANCE`, `PL`, `CASH_FLOW`, `EQUITY_CHANGES`, `NOTES`
- Each line defines: `lineCode`, `labelAz`, `labelEn`, `nasPrefixes[]`, optional `offsetPrefixes[]`, `sign` (debit/credit aggregation rule).

Loader: `mhbs-statements-catalog.util.ts`.

### Generator

**`MhbsStatementsService`** aggregates posted NAS (or IFRS when requested) balances:

| Form | MoF report | Data sources |
|------|------------|--------------|
| Balance | Maliyyə vəziyyəti haqqında hesabat | Trial balance as-of; PPE/IA net (111−112, 131−132); charter **821**, retained **802/801** |
| P&L | Mənfəət və zərər haqqında hesabat | `ReportingService.fullIncomeStatement` period range |
| Cash flow | Pul vəsaitlərinin hərəkəti | Extended `CashFlowService` statutory layout |
| Equity changes | Kapitalda dəyişikliklər | Movement on 821/802/811/801 for fiscal year |
| Notes | Qeydlər | Basic disclosure template from balances |

**Bugfix (Wave 4):** charter capital uses account **821**, not **301**.

### API and UI

- Controller prefix: **`GET /api/reports/statements/*`**
  - `balance`, `pl`, `cash-flow`, `equity-changes`, `notes`
  - `…/export?format=xlsx|pdf` for each form
- Web hub: **`/reports/statements`** (tabs per form, date/year pickers, export buttons)
- `@RequiresModule(tax_pro)` on all statement routes.

### Export

- XLSX and PDF via `MhbsStatementsService.exportXlsx` / `exportPdf` (official blank layout approximation; verify against current MoF PDF/XSD before production filing).

## Consequences

- Catalog must be updated when MoF revises line codes — version field in JSON meta.
- Statistical reporting packages remain **not implemented** (separate from MHBS financial statements).
- IFRS book can generate parallel statements when `ledgerType=IFRS`; NAS is default for AZ statutory filing.

## Non-goals (Wave 4)

- Direct e-taxes upload of MHBS XML (file export only).
- Full notes disclosure set matching every NAS note requirement in large holdings.

## Related

- Wave 3 fiscal year reformation (`closeFiscalYear`) feeds equity and retained earnings lines.
