# Data Hub — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Data-Hub-Product-Readiness-Matrix.md`](./Data-Hub-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Data-Hub-Implementation-Matrix.md`](./Data-Hub-Implementation-Matrix.md)  
**Evidence:** [`Data-Hub-Evidence-Rules.md`](./Data-Hub-Evidence-Rules.md)  
**Index:** [`Data-Hub-Sprint-Index.md`](./Data-Hub-Sprint-Index.md)  
**Edition:** [`docs/editions/data-hub.yaml`](../editions/data-hub.yaml)  
**Apps:** `era-data-hub`

---

## Scope

- In scope: Reference data registry API (FX, banks/IBAN, VÖEN, HS, catalogs); service-token auth; HEADLESS consumers
- Out of scope: Public end-user UI; live e-taxes without BLOCKED clearance

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
node scripts/run-data-hub-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
