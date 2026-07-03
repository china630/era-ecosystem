# Azerbaijan legal entities — e-taxes enrichment

Merged registry from **all donor lists** enriched with DVX e-taxes search.

**Donor sectors:** hotels, accountants, **legal** (law firms, customs brokers, consulting), **telecommunications**, **government**, medical-institutions, construction-companies, exhibitions, travel-agencies, business-plazas, financial-institutions (insurers, BOKT), education (private schools), event-organizers.

**Government procurement suppliers** (`government-procurement/azerbaijan-etender-suppliers.csv`) are merged via `npm run merge:voen-donors` — not loaded into full e-taxes name-search enrichment (volume).

**Dedup:** one donor row per normalized company name (`normalizeNameKey`); cross-sector duplicates merged. Output CSV keeps only rows with `donor_ids` (no orphan tax-registry noise from broad queries).
([Kommersiya qurumlarının dövlət reyestri](https://new.e-taxes.gov.az/etaxes/services/legal-entity-info)).

## Output

| File | Description |
|------|-------------|
| `azerbaijan-legal-entities.csv` | Single deliverable: tax registry fields + all donor fields preserved |
| `azerbaijan-tax-registry-expanded.csv` | **All** cache hits (incl. orphan tax rows without `donor_ids`); rebuilt from `.cache/etaxes-search/` |

## Expanded registry (cache rebuild)

Donor enrich writes only rows with `donor_ids`. Orphan tax hits stay in `.cache/etaxes-search/`. Rebuild expanded CSV without re-querying DVX:

```bash
npm run rebuild:etaxes-expanded
```

After etender suppliers/buyers name-search wave populates more cache:

```bash
npm run enrich:etaxes-etender-wave      # suppliers + buyers → cache
npm run rebuild:etaxes-expanded         # refresh expanded CSV
```

Watcher (`npm run pipeline:watch`) runs merge → retry → export → etender-wave → expanded rebuild when enrich completes.

## How to regenerate

```bash
# Full run (deduped donors, primary + alternate tokens; hours with cache)
npm run enrich:etaxes -- --force

# Smoke test (first 20 queries)
npm run enrich:etaxes:test
```

Requires `playwright` (root `devDependency`). Browser session loads the public page, then calls
`POST /api/po/authless/public/v1/authless/findTaxpayer` with cookies (anti-bot friendly).

### Options

| Flag / env | Meaning |
|------------|---------|
| `--force` | Re-run even if `.enrich-complete.json` exists |
| `--limit N` | Process only first N **primary** search queries (smoke) |
| `ETAXES_DELAY_MS` | Min delay between queries (default 2500) |
| `ETAXES_MAX_DELAY_MS` | Max delay jitter (default 4500) |

Resume: search responses are cached under `.cache/etaxes-search/` — re-run skips cached queries.

## Search query rules

From each donor name:

1. Strip legal suffixes (MMC, hospital, klinik, audit, …)
2. If **compound** (≥2 tokens ≥3 chars) → use **first token** only
3. Query must be ≥3 chars and contain at least one letter (no pure digits)

## Row types (`match_status`)

| Status | Meaning |
|--------|---------|
| `tax_matched` | Donor linked to e-taxes VÖEN row |
| `voen_known` | VÖEN + name from trusted registry (CBAR, etender); tax fields filled via merge or VÖEN lookup |
| `no_tax_match` | Deduped donor with no registry match after primary + alternate tokens |

### Viewing donors without tax match (861 rows)

These are **source records** (hotels, clinics, auditors, …) where e-taxes search returned **zero** usable hits for the derived query. They are **not** extra companies from the tax registry — they keep donor name/phone/address only, with empty `tax_*` columns.

| How | File / command |
|-----|----------------|
| **Dedicated export** | `data/legal-entities/azerbaijan-donors-no-tax-match.csv` |
| **Filter main CSV** | `match_status=no_tax_match` in `azerbaijan-legal-entities.csv` |
| **Regenerate export** | `python tools/export_no_tax_match_donors.py` |

Typical reasons: **over-short search token** (e.g. `AKK` instead of `AKK-NET AUDİT`), stripping `AUDİT` from auditor names, spelling/hyphen mismatch (`AKK-NET` vs `AKK NET`), inactive entity, or brand ≠ legal name in DVX.

**Retry with alternate tokens:** `tools/etaxes-search-utils.mjs` now uses the **full quoted trade name** first (same as manual UI search), keeps `AUDİT` in auditor names, and tries hyphen/space variants. To re-attempt unmatched donors:

```bash
npm run retry:etaxes-no-match:test   # first 30 rows
npm run retry:etaxes-no-match        # all no_tax_match rows (~861, slow)
```

After a successful retry run, regenerate the export: `npm run export:no-tax-match-donors`.

**Note:** `tax_matched` rows (21,144) include many **extra** tax hits per search query (not only donors) — that is separate from the 861 donor-only misses.

Donor fields are merged into tax rows when VÖEN matches or name fuzzy-matches within the same search batch.
Multiple donors can attach to one tax row (`donor_*` columns pipe-separated).

## Key columns

- **Tax:** `voen`, `tax_name`, `tax_legal_address`, `tax_legitimate`, `tax_legal_form`, `tax_charter_capital`, `tax_vat_payer`, `tax_risky_payer`, `tax_debt`, `tax_status`, …
- **Donor:** `donor_sectors`, `donor_names`, `donor_phones`, `donor_emails`, `donor_categories`, `donor_extra_json`, …
- **Audit:** `search_query`, `tax_raw_json` (full API payload)

## CRM prospect import (planned v3.0)

Enriched CSV is the **canonical bulk source** for `era-crm` lead import (upload, not auto-sync from this folder).

| Doc | Role |
|-----|------|
| [docs/adr/crm-lead-party-model-and-prospect-import.md](../../docs/adr/crm-lead-party-model-and-prospect-import.md) | Column mapping, dedup, `activitySector` from `donor_sectors` |
| [era-crm PRD §9](../../era-crm/PRD.md#9-roadmap--v30-party-model-partners-import) | User stories, modules M11–M16 |
