# Demo / TE package — Construction Pilot W1–W3 (~35 min)

**Audience:** sales engineer / TE  
**Not:** field Pilot, edition `ga`, or SHOW claim.

## Prep (5 min)

1. Orch + Construction + Finance up; SKUs: `construction_estimate_hierarchy`, `construction_smeta_rate_engine`, Finance `contract_payapp_ks`.
2. Lab org with a Finance contract id ready to paste.
3. Local login Construction ops + Finance user for same org.

## Script

| Min | Step |
|-----|------|
| 0–5 | Construction `/admin/rate-bases`: create base + item (amount > 0); optional hub material code |
| 5–15 | Project hub **Estimate**: hierarchy mode, save financeContractId, pack → lines / Apply rate → approve; show SOV verify hint |
| 15–20 | Finance `/contracts/{id}`: show SOV lines |
| 20–25 | Construction **Ops**: BOQ → draft act → lines → approve; show journal key |
| 25–28 | Finance `/reporting/journal`: find `construction:{actId}` |
| 28–35 | Finance `/pay-applications` from SOV → KS-2/KS-3 print; paste PayApp id back on approved act |

## Honesty closer

Say: ops pack + Finance bridge for lab demo; money SoR stays Finance; not GA / not field Pilot.
