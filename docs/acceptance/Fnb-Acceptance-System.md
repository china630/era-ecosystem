# F&B — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Fnb-Product-Readiness-Matrix.md`](./Fnb-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Fnb-Implementation-Matrix.md`](./Fnb-Implementation-Matrix.md)  
**Evidence:** [`Fnb-Evidence-Rules.md`](./Fnb-Evidence-Rules.md)  
**Index:** [`Fnb-Sprint-Index.md`](./Fnb-Sprint-Index.md)  
**Edition:** [`docs/editions/fnb.yaml`](../editions/fnb.yaml)  
**Apps:** `era-fnb-pos`

---

## Scope

- In scope: Floor POS, KDS, recipes, delivery inbox, labor roster
- Out of scope: Hotel FO SoT; live fiscal beyond stub
- **Declared, not this edition:** SHARED F&B pool — [deployment-topology.md](../adr/deployment-topology.md). Waves 3–5: Outlet/Ticket/menu/staff tenant roots + kit filter (CP-TENANT-01 API); Nafta F&B = DEDICATED/ONPREM (Outlet remains POS axis).

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
node scripts/run-fnb-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
