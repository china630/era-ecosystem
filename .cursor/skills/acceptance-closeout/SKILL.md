---
name: acceptance-closeout
description: >-
  Close a product task against ERA Acceptance Standard — COVERAGE + Matrix SSOT,
  gate vs AC, Readiness vs BE, consistency script, no false-green. Use after
  finishing a feature, stage wave, AuthZ/security change, or before claiming
  Scaffold ✅ / Pilot-ready / SHIPPED.
---

# Acceptance closeout

**Canon:** `docs/products/ERA-Acceptance-Standard.md`  
**Agent rule:** `.cursor/rules/task-acceptance.mdc`  
**Index:** `docs/acceptance/README.md`

## Steps (mandatory)

1. Identify product line (see task-acceptance table).
2. Update **COVERAGE_MATRIX** Doc/API/actor columns for touched IDs.
3. Update **Implementation-Matrix** (SSOT of AC/BE color):
   - Scaffold ✅ only if PRD wording + **negative path** + no Critical residual + not field-intent.
   - Else 🟡. Worst-component: any 🟡 sub-row → AC 🟡.
   - Pilot-ready separate; field AC max Scaffold 🟡.
4. Update **Product-Readiness-Matrix** (Gate, BE, UI, Demo, Pilot, Edition, Sell); rollup = worst layers.  
   If a human show/edit screen appeared or vanished: update [`UI-COVERAGE-BOARD.md`](../../docs/acceptance/UI-COVERAGE-BOARD.md) class (NONE/SCREEN/SHOW). Sell still from Product-Readiness only.
5. **Bank:** update [`Bank-Capability-Inventory.md`](../../docs/acceptance/Bank-Capability-Inventory.md) if scope IN/PARTIAL/DECLARED/OUT changed; never narrate AC ✅ as full ABS.
6. Sync rollups in the **same change**: Sprint-Index, editions yaml if sell claim changed.
7. Run:

```bash
npm run check:acceptance
# before PR:
npm run check:acceptance:strict
```

Must exit 0. Fix banned `all ✅` / false `ga` prose if FAIL.
8. Editions `ga` only from `docs/editions/*.yaml` after Pilot-ready + field proof.
9. Proof: `reports/*-signoff.md` or UAT-SMOKE UI path linked from Matrix/Index.

## Engineering API track (separate)

If consumer hooks / API levels / DELIVERY % changed → also run skill `era-readiness-matrix`.
That updates `docs/READINESS_MATRIX.md` — **not** Product-Readiness sell/show.

## Forbidden

- Closing a product line via DELIVERY checkbox alone.
- Treating stage `gate[x]` or COVERAGE SHIPPED as AC Scaffold ✅.
- Writing «Matrix all ✅» / «product ready» / MODULES DONE as GA when Readiness rollup is 🟡/❌.
- Answering «готовность» (sell/show) from Implementation-Matrix or READINESS_MATRIX alone.
