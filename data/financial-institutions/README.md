# Azerbaijan financial institutions (CBAR registries)

Licensed insurers and non-bank credit organizations from the Central Bank public lists.

## Output

| File | Description |
|------|-------------|
| `azerbaijan-insurers.csv` | **16** | Insurers / reinsurers with **VÖEN** |
| `azerbaijan-bokt.csv` | **51** | BOKT — license + address, no VÖEN on CBAR page |

## Sources

- [Insurers and reinsurers](https://www.cbar.az/page-202/insurers-and-reinsurers)
- [Non-bank credit institutions](https://www.cbar.az/page-196/non-bank-credit-institutions)

## Regenerate

```bash
npm run scrape:cbar-financial
```

Insurers are merged into `data/legal-entities/azerbaijan-companies-with-voen.csv` via donor/master enrich waves (VÖEN known). BOKT rows go through e-taxes name search in `npm run enrich:etaxes`.
