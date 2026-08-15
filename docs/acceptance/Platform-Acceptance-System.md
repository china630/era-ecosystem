# Platform — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Platform-Product-Readiness-Matrix.md`](./Platform-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Platform-Implementation-Matrix.md`](./Platform-Implementation-Matrix.md)  
**Evidence:** [`Platform-Evidence-Rules.md`](./Platform-Evidence-Rules.md)  
**Index:** [`Platform-Sprint-Index.md`](./Platform-Sprint-Index.md)  
**Edition:** [`docs/editions/platform.yaml`](../editions/platform.yaml)  
**Apps:** `era-orchestrator`

---

## Scope

- In scope: SSO/launcher, org/billing, entitlements, MDM, workforce hub, super-admin
- Out of scope: Industry ops screens (live on satellites)

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
node scripts/run-platform-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
