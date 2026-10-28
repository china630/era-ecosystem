# F&B buffet cost — lab demo signoff (unsigned)

| Field | Value |
|-------|-------|
| Capability | `FNB-BUFFET-COST-01` |
| Lab org | ERA ID **100000** (not sentinel) |
| Seeds | `era-fnb-pos` `db:seed:buffet-demo` + Finance `db:seed:buffet-demo` |
| UAT | [`era-fnb-pos/doc/UAT-SMOKE.md`](../era-fnb-pos/doc/UAT-SMOKE.md) § Chef demo path (lab seed) |
| Finance twin | [`era-finance-core/doc/UAT-SMOKE.md`](../era-finance-core/doc/UAT-SMOKE.md) § FIN-BUFFET-FOOD-01 |
| Result | **pending** |
| Signed by | — |
| Date | — |

## Honesty

- Lab seed + this template = **lab readiness only**.
- Does **not** equal Pilot field, SHOW, SHIPPED, Scaffold ✅, or edition `ga`.
- Agent must **not** forge a pass; a human signs after a live walkthrough.
- After human sign: may link Demo lab artifact in Product-Readiness; still not Pilot/`ga` without full Evidence Rules.

## Checklist (chef path)

- [ ] F&B seed: `fnb_buffet_planner` on; outlet code recorded; HYBRID; MID guest-nights; 7 plan days; staff covers; COMP ticket
- [ ] Finance seed: FOOD WH `satelliteOutletCode` matches; `foodUsageAzn > 0`; Non-FOOD plan + fact in `outletBudget` / WH OUT
- [ ] Forecast / Staff / covers rollup visible (Phase B)
- [ ] Cost run → Open Finance HYBRID without JSON paste (Phase A)
- [ ] Finance buckets + reliability (+ optional ISSUES_ONLY) (Phase C)
- [ ] Non-FOOD plan/fact nonzero
- [ ] No Critical residual blocking demo narrative

## Notes

_Week from–to (seed printout):_

_Outlet code:_

_Observer notes:_
