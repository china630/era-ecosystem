# Azerbaijan exhibition exhibitors (Iteca / ERA CMS)

Exhibitor lists from construction, HVAC, medical, and beauty trade fairs.

## Output

| File | Rows | Description |
|------|------|-------------|
| `azerbaijan-exhibition-exhibitors.csv` | **1060** | Deduped companies (`norm_key` on name) |
| `azerbaijan-exhibition-exhibitors-raw.csv` | **2555** | All rows: site × year × category |

## Sources

| Site | URL pattern |
|------|-------------|
| [BakuBuild](https://bakubuild.az/az/exhibitors-list/year/2025) | `bakubuild.az` |
| [Aquatherm Baku](https://aquatherm.az/az/exhibitors-list/year/2025) | `aquatherm.az` |
| [Medinex](https://medinex.az/az/exhibitors-list/year/2026) | `medinex.az` |
| [Beauty Expo](https://beautyexpo.az/az/exhibitors-list/year/2022) | `beautyexpo.az` |
| [InterFood](https://interfood.az/az/exhibitors-list) | `interfood.az` |
| [Caspian Oil & Gas](https://caspianoilgas.az/az/exhibitors-list) | `caspianoilgas.az` |
| [Securex Caspian](https://securexcaspian.az/az/exhibitors-list) | `securexcaspian.az` |
| [TransLogistica](https://translogistica.az/az/exhibitors-list) | `translogistica.az` |
| [Caspian Agro Week](https://caspianagroweek.az/az/exhibitors-list) | `caspianagroweek.az` |
| [Plastex](https://plastex.az/az/exhibitors-list) | `plastex.az` |

Data API: `ERAForms/companies_list.php?l=az&exhibition={id}` (DataTables POST).  
Only **Azərbaycan** exhibitors (`field1` = country id from page, default `1`).

Categories come from `<!--group-head-->` rows in API HTML (same as on-site grouping).

## Regenerate

```bash
npm run scrape:exhibition-exhibitors
# or
python tools/scrape_exhibition_exhibitors.py
```

## Next step

When approved: add as donor sector in `enrich-etaxes` + retry `no_tax_match` donors.
