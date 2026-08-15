# Auto Service — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Auto-Product-Readiness-Matrix.md`](./Auto-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Auto-Implementation-Matrix.md`](./Auto-Implementation-Matrix.md)  
**Evidence:** [`Auto-Evidence-Rules.md`](./Auto-Evidence-Rules.md)  
**Index:** [`Auto-Sprint-Index.md`](./Auto-Sprint-Index.md)  
**Edition:** [`docs/editions/auto.yaml`](../editions/auto.yaml)  
**Apps:** `era-auto-service`

---

## Scope

- In scope: Work orders, appointments, service-due cron, platform commerce hooks
- Out of scope: VIN catalogue vendor field certification

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
node scripts/run-auto-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
