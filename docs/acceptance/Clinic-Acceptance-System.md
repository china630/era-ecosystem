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

- In scope: ops clinic + sanatorium day-ops, SatAdmin catalogs, cashier settle/ops (stub fiscal), print forms, lab orders ops, Nafta pilot contours
- Out of scope: live HL7 LIS vendor (CLI-23 External), real NBC fiscal / KKM (CLI-24 External), retail pharmacy / Rx reserve
- **Declared, not SHIPPED:** gender session windows — [clinic-procedure-gender-session-windows.md](../adr/clinic-procedure-gender-session-windows.md) (CLI-48 API+SatAdmin UI; UAT open); matrix replan — [clinic-procedure-matrix-replan.md](../adr/clinic-procedure-matrix-replan.md) (CLI-49 API+wizard UI; UAT open)
- **Declared, API not SHIPPED:** procedure TTK → Finance inventory — [clinic-procedure-consumable-ttk.md](../adr/clinic-procedure-consumable-ttk.md) (CLI-47 API; UAT open)
- **Declared, not this edition:** SHARED multi-tenant clinic pool and automated topology migrate — [deployment-topology.md](../adr/deployment-topology.md). Waves 3–5: tenant roots + kit filter (CP-TENANT-01 API / AC-CLI-TENANT 🟡); Nafta remains one-org DEDICATED/ONPREM. Do not sell SHARED clinic.

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
