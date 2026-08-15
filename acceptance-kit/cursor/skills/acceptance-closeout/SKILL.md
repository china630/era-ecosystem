---
name: acceptance-closeout
description: >-
  Close a product task against Product Acceptance Standard — Matrix SSOT,
  gate vs AC, Readiness vs BE, consistency script, no false-green. Use after
  finishing a feature, stage wave, AuthZ/security change, or before claiming
  Scaffold ✅ / Pilot-ready.
---

# Acceptance closeout

**Canon:** `docs/products/Product-Acceptance-Standard.md`  
**Agent rule:** `.cursor/rules/task-acceptance.mdc`

## Steps (mandatory)

1. Identify product line (see task-acceptance table).
2. Update **Implementation-Matrix** (SSOT of AC/BE color):
   - Scaffold ✅ only if PRD wording + **negative path** + no Critical residual + not field-intent.
   - Else 🟡. Worst-component: any 🟡 sub-row → AC 🟡.
   - Pilot-ready separate; field AC max Scaffold 🟡.
3. Update **Product-Readiness-Matrix** (Gate, BE, UI, Demo, Pilot, Edition, Sell); rollup = worst layers.
4. Sync rollups in the **same change**: Sprint-Index, MVP/Program header, Gap-List, PRD status if colored.
5. Run:

```powershell
pwsh -NoProfile -File scripts/check-acceptance-consistency.ps1
```

Must exit 0. Fix banned `all ✅` / false `ga` prose if FAIL.
6. Editions `ga` only from yaml SSOT after Pilot-ready.
7. Proof: `reports/*` log or CI artifact linked from Matrix/Index.

## Forbidden

- Closing a product line via an unrelated sprint-spec alone.
- Treating stage `gate[x]` as AC Scaffold ✅.
- Writing «Matrix all ✅» / «product ready» when Readiness rollup is 🟡/❌.
- Answering «готовность» from Implementation-Matrix only.
