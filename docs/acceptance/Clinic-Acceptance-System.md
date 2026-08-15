# Clinic — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Clinic-Product-Readiness-Matrix.md`](./Clinic-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Clinic-Implementation-Matrix.md`](./Clinic-Implementation-Matrix.md)  
**Evidence:** [`Clinic-Evidence-Rules.md`](./Clinic-Evidence-Rules.md)  
**Index:** [`Clinic-Sprint-Index.md`](./Clinic-Sprint-Index.md)  
**Edition:** [`docs/editions/clinic.yaml`](../editions/clinic.yaml)  
**Apps:** `era-clinic`

---

## Scope

- In scope: ops clinic + sanatorium day-ops, SatAdmin catalogs, cashier (mock fiscal), print forms, Nafta pilot contours
- Out of scope: live HL7 LIS vendor, real NBC fiscal, multi-tenant shared clinic DB

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
node scripts/run-clinic-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
