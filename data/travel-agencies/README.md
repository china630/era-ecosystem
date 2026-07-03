# Azerbaijan travel agencies

Tour operator / travel agency prospects merged from EW export and public directories.

## Output

| File | Rows | Description |
|------|------|-------------|
| `azerbaijan-travel-agencies.csv` | **346** | Master list (dedup by normalized name) |
| `azerbaijan-turlar-shops.csv` | 102 | Raw scrape from [turlar.az/shops](https://turlar.az/shops) |
| `azerbaijan-trippost-travel.csv` | 77 | Raw scrape from [trippost.az/explore/?type=turizm-sirketleri](https://trippost.az/explore/?type=turizm-sirketleri) |

## Sources

| Source | Records | Notes |
|--------|---------|-------|
| EW `Travel Agencies.xlsx` | 193 unique (188 in merge) | Hotel PMS export; no address/VÖEN |
| turlar.az | 102 | Joomla campdiv listings, 4 pages |
| trippost.az | 77 | MyListing AJAX API |
| Overlap | 15 multi-source | Same agency in EW + directory |

`city` defaults to Bakı when unknown. `extra_json` holds profile URLs, listings count, EW agent codes.

## Regenerate

```bash
# EW only (legacy)
npm run export:travel-agencies

# Full pipeline
npm run collect:travel-agencies
# or step by step:
npm run scrape:turlar-shops
npm run scrape:trippost-travel
npm run merge:travel-agencies
```

## Next step (optional)

Feed into e-taxes enrichment as donor sector `travel_agencies` when approved.
