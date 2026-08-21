# Construction — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Construction-Product-Readiness-Matrix.md`](./Construction-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Construction-Implementation-Matrix.md`](./Construction-Implementation-Matrix.md)  
**Evidence:** [`Construction-Evidence-Rules.md`](./Construction-Evidence-Rules.md)  
**Index:** [`Construction-Sprint-Index.md`](./Construction-Sprint-Index.md)  
**Edition:** [`docs/editions/construction.yaml`](../editions/construction.yaml)  
**Apps:** `era-construction`

---

## Scope

- **Declared, not this edition:** SHARED multi-tenant pool and automated topology migrate — [deployment-topology.md](../adr/deployment-topology.md). CP-TENANT-01 schema+filter / AC-CON-TENANT 🟡; appliance remains one-org DEDICATED/ONPREM. Do not sell SHARED Construction.

- In scope: Projects, BOQ stub, progress acts, material requisitions, plan vs actual, platform hooks
- Out of scope: Full CDE/partner field certification

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
node scripts/run-construction-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
