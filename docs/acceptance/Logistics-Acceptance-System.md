# Logistics — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Logistics-Product-Readiness-Matrix.md`](./Logistics-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Logistics-Implementation-Matrix.md`](./Logistics-Implementation-Matrix.md)  
**Evidence:** [`Logistics-Evidence-Rules.md`](./Logistics-Evidence-Rules.md)  
**Index:** [`Logistics-Sprint-Index.md`](./Logistics-Sprint-Index.md)  
**Edition:** [`docs/editions/logistics.yaml`](../editions/logistics.yaml)  
**Apps:** `era-logistics`

---

## Scope

- **Declared, not this edition:** SHARED multi-tenant pool and automated topology migrate — [deployment-topology.md](../adr/deployment-topology.md). CP-TENANT-01 schema+filter / AC-LOG-TENANT 🟡; appliance remains one-org DEDICATED/ONPREM. Do not sell SHARED Logistics.

- In scope: Fleet/trips, POD, fuel, customs/FX/HS preview via Finance, platform add-ons on trip complete
- Out of scope: Live customs brokerage certification; own GL SoT

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
node scripts/run-logistics-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
