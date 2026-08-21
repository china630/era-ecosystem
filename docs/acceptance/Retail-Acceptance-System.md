# Retail — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Retail-Product-Readiness-Matrix.md`](./Retail-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Retail-Implementation-Matrix.md`](./Retail-Implementation-Matrix.md)  
**Evidence:** [`Retail-Evidence-Rules.md`](./Retail-Evidence-Rules.md)  
**Index:** [`Retail-Sprint-Index.md`](./Retail-Sprint-Index.md)  
**Edition:** [`docs/editions/retail.yaml`](../editions/retail.yaml)  
**Apps:** `era-retail-pos`

---

## Scope

- In scope: POS, promos, BOPIS, stock, fiscal stub, marketplace webhooks
- Out of scope: Live KKM certification
- **Declared, not this edition:** SHARED retail pool — [deployment-topology.md](../adr/deployment-topology.md). Tenant roots + kit filter (CP-TENANT-01 API / AC-RET-TENANT 🟡); Nafta retail = DEDICATED/ONPREM. Do not sell SHARED retail.
- **Wave 8:** AC-RET-FISCAL stays Scaffold 🟡 (External STUB) and is **out of Scaffold BE rollup** (Hotel INT) — Scaffold BE ✅ ≠ live fiscal GA

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
node scripts/run-retail-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
