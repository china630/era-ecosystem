# Azerbaijan government bodies — donor registry

State **institutions** from Wikipedia category tree (ministries, agencies, courts, ASAN, funds, …).

## Output

| File | Description |
|------|-------------|
| `azerbaijan-state-organizations.csv` | **211** organizations (institutions only) |

## Source

[Wikipedia — Kateqoriya:Azərbaycanın dövlət təşkilatları](https://az.wikipedia.org/wiki/Kateqoriya:Azərbaycanın_dövlət_təşkilatları)

Scraper uses the MediaWiki API (`categorymembers`) and walks subcategories. Biographical branches (ministers, deputies, police officers, graduates, …) are **skipped**; only articles with institution markers (agentlik, nazirlik, xidmət, fond, məhkəmə, …) are kept. Responses are cached under `.cache/wiki-categories/` for fast re-runs.

## Columns

`id`, `name`, `entry_type` (always `organization`), `letter_group`, `org_kind`, `wikipedia_url`, `category_path`, `category_paths`, `found_in_category_url`, `source`, `source_url`

- `category_path` — primary breadcrumb in the category tree
- `category_paths` — all non-biographical paths when an article appears under multiple categories

### `org_kind` (heuristic)

`agency`, `state_service`, `fund`, `commission`, `center`, `court`, `ministry`, …

## Regenerate

```bash
npm run scrape:wikipedia-government
```

## Enrichment

Loaded by `tools/enrich-etaxes-legal-entities.mjs` as donor sector **`government`**.
