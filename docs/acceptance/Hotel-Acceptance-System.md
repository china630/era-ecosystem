# Hotel — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Hotel-Product-Readiness-Matrix.md`](./Hotel-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Hotel-Implementation-Matrix.md`](./Hotel-Implementation-Matrix.md)  
**Evidence:** [`Hotel-Evidence-Rules.md`](./Hotel-Evidence-Rules.md)  
**Index:** [`Hotel-Sprint-Index.md`](./Hotel-Sprint-Index.md)  
**Edition:** [`docs/editions/hotel.yaml`](../editions/hotel.yaml)  
**Apps:** `era-hotel-pms`

---

## Scope

- In scope: FO screen chain, cash/city ledger MVP, HK, rates, guest MDM, Nafta ops
- Out of scope: Opera-depth AR, live NBC KKM, door locks field certification

## Definition of Done (soft / scaffold)

- [ ] Unit / golden / integration tests for changed surface
- [ ] Stage-gate signoff under `reports/`
- [ ] Implementation-Matrix row updated (✅ only per canon §3.2)
- [x] Product-Readiness-Matrix columns updated if UI/Demo/Pilot touched
- [ ] COVERAGE_MATRIX actor row(s) updated
- [ ] `npm run check:acceptance` PASS

## Definition of Done (pilot / GA)

- [ ] Pilot lab checklist signed
- [ ] Field AC not Scaffold ✅ until field proof
- [ ] Edition yaml `ga` only after `pilot_ready: true` + Pilot field

## Gate script

```bash
node scripts/run-hotel-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
