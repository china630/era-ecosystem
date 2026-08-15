# Wholesale — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Wholesale-Product-Readiness-Matrix.md`](./Wholesale-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Wholesale-Implementation-Matrix.md`](./Wholesale-Implementation-Matrix.md)  
**Evidence:** [`Wholesale-Evidence-Rules.md`](./Wholesale-Evidence-Rules.md)  
**Index:** [`Wholesale-Sprint-Index.md`](./Wholesale-Sprint-Index.md)  
**Edition:** [`docs/editions/wholesale.yaml`](../editions/wholesale.yaml)  
**Apps:** `era-wholesale`

---

## Scope

- In scope: B2B orders, pick lists, credit limit, TTN/pick waves, platform commerce hooks
- Out of scope: Full EDI partner certification without field

## Definition of Done (soft / scaffold)

- [ ] Unit / golden / integration tests for changed surface
- [ ] Stage-gate signoff under `reports/`
- [ ] Implementation-Matrix row updated (✅ only per canon §3.2)
- [ ] Product-Readiness-Matrix columns updated if UI/Demo/Pilot touched
- [ ] COVERAGE_MATRIX actor row(s) updated
- [ ] `npm run check:acceptance` PASS

## Definition of Done (pilot / GA)

- [ ] Pilot lab checklist signed
- [ ] Field AC not Scaffold ✅ until field proof
- [ ] Edition yaml `ga` only after `pilot_ready: true` + Pilot field

## Gate script

```bash
node scripts/run-wholesale-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
