# F&B buffet — chef-ready browser punchlist (unsigned)

| Field | Value |
|-------|-------|
| Capability | `FNB-BUFFET-COST-01` |
| Work order | Chef-ready A1–A9 / C4–C6 (2026-10-29) |
| Lab path | Forecast → Staff → Cost run → Open Finance → buckets → Non-FOOD → Print |
| Result | **blocked / not executed live** |
| Signed by | — |
| Date | 2026-10-29 |

## Honesty

- This file is an **unsigned** engineering punchlist from the chef-ready implementation wave.
- It does **not** sign [`fnb-buffet-cost-lab-signoff.md`](./fnb-buffet-cost-lab-signoff.md).
- Does **not** authorize Demo ✅ / SHOW / SHIPPED / Pilot / `ga`.

## Environment at attempt

| Check | Result |
|-------|--------|
| F&B `http://localhost:3202/api/health` | Timeout — host Next not running |
| Finance `http://localhost:3001/api/health` | Timeout — host Next not running |
| Lab seed (`db:seed:buffet-demo`) | Not re-run in this session |

## Intended chef path (when lab is up)

1. Seed F&B + Finance buffet demo (ERA ID 100000).
2. F&B `/admin/buffet` → Forecast: guest-nights + CatalogField SKU/UoM/bands.
3. Staff tab: covers plan visible; honesty line for composition.
4. Cost run: auto staff gross (override empty); COMP AZN from Finance catalog; outlet code shown; Open Finance HYBRID.
5. Finance `/inventory/buffet-food-cost`: buckets, SKU variance highlight, ISSUES_ONLY → settings#warehouses + `/inventory/audits`, Non-FOOD tab, Print report.
6. Confirm outlet CatalogField on WH settings; mismatch banner if codes diverge.

## Bugs / residuals found in code review (pre-browser)

| Severity | Note |
|----------|------|
| Blocked | Live UI walkthrough not run — no local F&B/Finance health. |
| Info | COMP COGS still 0 if Finance catalog URL/token unset (`FINANCE_CATALOG_UNAVAILABLE` chef warning). |
| Info | Staff auto = 0 if no staff plan covers for period (override still available). |

## Next for human signoff

1. Start Local Folder Dev for F&B + Finance; run buffet demo seeds.
2. Walk the path above; tick [`fnb-buffet-cost-lab-signoff.md`](./fnb-buffet-cost-lab-signoff.md).
3. Only then claim Demo ✅ / SHOW per Evidence Rules.
