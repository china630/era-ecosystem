# CRM — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Crm-Product-Readiness-Matrix.md`](./Crm-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Crm-Implementation-Matrix.md`](./Crm-Implementation-Matrix.md)  
**Evidence:** [`Crm-Evidence-Rules.md`](./Crm-Evidence-Rules.md)  
**Index:** [`Crm-Sprint-Index.md`](./Crm-Sprint-Index.md)  
**Edition:** [`docs/editions/crm.yaml`](../editions/crm.yaml)  
**Apps:** `era-crm`

---

## Scope

- In scope: Leads, pipeline, visits, party profile, WhatsApp stage hook
- Out of scope: Full omnichannel GA without field proof

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
node scripts/run-crm-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
