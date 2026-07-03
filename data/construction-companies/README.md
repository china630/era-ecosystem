# Azerbaijan construction companies — insaat.az

Construction / building-material vendors and contractors from the public company directory.

## Output

| File | Rows | Description |
|------|------|-------------|
| `azerbaijan-construction-shops.csv` | 156 | Company profiles from [insaat.az/shops](https://insaat.az/shops) |

## Columns

`id`, `name`, `phone`, `profile_url`, `listings_count`, `description_snippet`, `source`, `source_url`

## Source

- **Site:** https://insaat.az/shops (İnşaat Şirkətləri)
- **Pagination:** `/shops?start=2` … `start=4` (96 + 20 + 20 + 20 cards)
- **Per row:** shop name, phone, short description, active listing count, profile URL (`/me/...`)

## Regenerate

```bash
python tools/scrape_insaat_shops.py
```

## Limits / enrichment

- No VÖEN, email, or legal address on listing pages — only what the shop publishes.
- Optional next step: e-taxes name search per company, or scrape individual `/me/...` profile pages for more contacts.

## Related ERA datasets

- `era-construction` satellite — operational counterparty data stays in product DB; this file is **prospect list** for sales/CRM.
