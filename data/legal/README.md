# Azerbaijan legal services — donor registries

Law firms, customs brokers, and consulting companies for e-taxes enrichment (`donor_sector: legal`).

## Files

| File | Source | Status |
|------|--------|--------|
| `azerbaijan-law-firms.csv` | [barassociation.az/communities](https://barassociation.az/communities) — Vəkil qurumları | scraped |
| `azerbaijan-customs-brokers.csv` | [customs.gov.az PDF registry](https://customs.gov.az/uploads/representative/7/2e69c2ce14c4bbb93388ea4a58387f2f.pdf) — Gömrük brokerləri | imported |
| `azerbaijan-consulting-firms.csv` | TBD (manual seed or future registry) | placeholder |

## Shared columns

`id`, `name`, `firm_type`, `registry_number` (customs only), `director`, `city`, `address`, `phones`, `email`, `community_id` (law firms), `lawyers_search_url`, `has_cabinets`, `source`, `source_url`

### `firm_type` values

| Value | Meaning |
|-------|---------|
| `law_firm` | Vəkil bürosu (bar association) |
| `customs_broker` | Dövlət gömrük brokerləri reyestri |
| `consulting_firm` | Consulting (manual / future) |

## Regenerate

```bash
npm run scrape:barassociation-law-firms
npm run import:customs-brokers
```

Customs import caches PDF under `.cache/customs-brokers-registry.pdf`. Requires `pypdf`:

```bash
python -m pip install pypdf
```

Override PDF URL: `CUSTOMS_BROKERS_PDF_URL=... npm run import:customs-brokers`

## Consulting firms

Add rows to `azerbaijan-consulting-firms.csv` with the same column shape (`firm_type=consulting_firm`). Scraper TBD.

## Enrichment

Loaded by `tools/enrich-etaxes-legal-entities.mjs` as donor sector **`legal`**.
