# Private education institutions (donor seed)

| File | Rows | Source |
|------|------|--------|
| `azerbaijan-private-schools.csv` | **37** (33 general + 4 vocational) | modern.az + edu.gov.az |

## Regenerate

```bash
npm run scrape:private-schools
```

Names only for general schools; colleges include address from edu.gov.az. Enrich via `npm run enrich:etaxes`.
