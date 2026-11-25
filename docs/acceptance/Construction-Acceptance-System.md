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

- **Plane ownership (fixed):** [construction-domain-boundaries.md](../adr/construction-domain-boundaries.md) — site ops in Construction; money in Finance; attendance SoR in CP; pre-sale in CRM. Do not accept ACs that relocate GL/payroll/CRM into this satellite.

- **Tenancy:** Construction defaults to **SHARED** (many `organizationId` in one deployment). Schema + kit tenant filter (CP-TENANT-01 / AC-CON-TENANT). DEDICATED/ONPREM only when product explicitly requests a placement change — not the default story.

- In scope: Projects, BOQ, five-level estimate pack (dual mode per project; ADR construction-estimate-hierarchy), progress acts (+ ops lines / Forma-2-class pack), material requisitions, plan vs actual, field logs, platform hooks, depth modules per PRD M13+ / M20
- Out of scope: Full CDE/partner field certification; Finance ledger / PayApp money truth; CRM pipeline UI; payroll SoR; full DESN **content** clone (rate-engine **MVP** is Construction SKU debt — [construction-smeta-rate-engine.md](../adr/construction-smeta-rate-engine.md), not edition `ga`)

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
