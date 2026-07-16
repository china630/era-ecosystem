# Catalog snapshots

| Path | Note (Data-Hub Phase 2) |
|------|-------------------------|
| `national/chart-of-accounts-*.json` | Optional local fallback for NAS provision when hub disabled; hub owns template SoR |
| `trade/customs-law-uom-mapping.json` | Law UoM code mapping (reference only; tariffs live in hub) |
| `bank/banks-table.md` | Historical source; bank seed generators removed — sync from hub |

Hub-owned: FX, HS tariffs, companies, banks/branches, geo, UoM, tax rates, NAS template.
Finance keeps Currency + FK cache tables.
