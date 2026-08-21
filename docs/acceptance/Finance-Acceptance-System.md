# Finance — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Finance-Product-Readiness-Matrix.md`](./Finance-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Finance-Implementation-Matrix.md`](./Finance-Implementation-Matrix.md)  
**Evidence:** [`Finance-Evidence-Rules.md`](./Finance-Evidence-Rules.md)  
**Index:** [`Finance-Sprint-Index.md`](./Finance-Sprint-Index.md)  
**Edition:** [`docs/editions/finance.yaml`](../editions/finance.yaml)  
**Apps:** `era-finance-core`

---

## Scope

- In scope: GL/NAS (including manual adjusting journal; wave 2 invoice credit adjustment + FA donation), AR/AP, inventory, HR/payroll, tax/statforms, FA, contracts, satellite event ingress
- Out of scope: Industry FO cash as SoT (hotel/clinic own ops money until posted)
- **Topology:** Finance is already multi-org in one DB. Dedicated finance = isolated Postgres + same binary. Sync pushes `POST/GET /api/internal/v1/runtime-config` to Finance Nest (AC-FIN-CFG Scaffold ✅ — negatives landed; Pilot/UI open) — [deployment-topology.md](../adr/deployment-topology.md) §4.

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
node scripts/run-finance-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
