# Azerbaijan telecommunications — operators and providers

Registered telecom operators, internet providers, and host providers from Wikipedia (sourced from Ministry of Digital Development registry).

## Output

| File | Description |
|------|-------------|
| `azerbaijan-telecom-operators.csv` | **187** entries — operators / ISPs / hosters |

## Source

[Wikipedia — Azərbaycan operator və provayderlərinin siyahısı](https://az.wikipedia.org/wiki/Az%C9%99rbaycan_operator_v%C9%99_provayderl%C9%99rinin_siyah%C4%B1s%C4%B1)

Original registry: Rəqəmsal İnkişaf və Nəqliyyat Nazirliyi (uçota alınmış operatorlar və provayderlər).

## Columns

`id`, `list_number`, `name`, `entity_type` (`company` / `individual` / `organization`), `legal_form` (MMC, QSC, ASC, …), `activity_types`, `is_operator`, `is_internet_provider`, `is_host_provider`, `website`, `source`, `source_url`

## Regenerate

```bash
npm run scrape:wikipedia-telecom
```

## Enrichment

Loaded by `tools/enrich-etaxes-legal-entities.mjs` as donor sector **`telecommunications`**.
