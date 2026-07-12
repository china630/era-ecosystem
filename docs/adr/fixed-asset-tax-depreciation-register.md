# ADR: Fixed asset tax depreciation register (NK Art. 114)

- **Status:** Accepted (Wave 2)
- **Date:** 2026-07-11
- **Related:** ERA Finance Wave 2 profit tax, `depreciation.service.ts`, `ProfitTaxAdjustment`

## Context

Azerbaijan corporate income tax requires **tax depreciation** under Tax Code Art. 114 (declining-balance groups), which differs from **book depreciation** under NAS (straight-line / reducing balance / units of production on `FixedAsset`).

Wave 2 profit tax aggregation needs a persistent tax NBV register and monthly tax depreciation amounts to auto-post the book-to-tax adjustment line (`AUTO_TAX_DEPRECIATION`).

## Decision

### Data model

- `FixedAssetTaxProfile` — one row per asset: `taxGroupCode`, `taxRatePercent`, `taxNbv`, `taxAccumulated`.
- `FixedAssetTaxDepreciationMonth` — idempotent monthly tax depreciation postings per asset.

### Computation

On `DepreciationService.runMonthlyDepreciation`, after book depreciation:

1. Ensure a tax profile exists (default group from national catalog seed).
2. Apply declining-balance monthly rate = `taxRatePercent / 12` on current tax NBV.
3. Persist month row and update profile NBV.

Tax group norms are seeded in `tax-depreciation-groups.v1.json` and editable in Super-Admin catalog.

### Book-to-tax bridge

`ProfitTaxService.syncAutoTaxDepreciationAdjustment(year)` creates/updates a **temporary** adjustment:

`amount = Σ tax depreciation − Σ book depreciation`

Manual permanent/temporary lines remain in `/reporting/profit-tax`.

### UI

- `/fixed-assets` list shows tax columns when `taxProfile` is returned by API.
- Asset edit modal shows tax profile read-only section when present.
- If no profile yet, note links to `/reporting/profit-tax`.

## Consequences

- Tax and book depreciation stay parallel; no single combined register.
- First tax profile appears after first successful monthly depreciation run.
- Super-Admin can adjust national tax group rates without code deploy.

## Non-goals

- Full statutory fixed-asset **disposal** tax forms.
- Separate intangible-assets (НМА) module.
