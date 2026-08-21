# Bank DBO — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Bank-DBO-Product-Readiness-Matrix.md`](./Bank-DBO-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Bank-DBO-Implementation-Matrix.md`](./Bank-DBO-Implementation-Matrix.md)  
**Parent capability boundary:** [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md)  
**Evidence:** [`Bank-DBO-Evidence-Rules.md`](./Bank-DBO-Evidence-Rules.md)  
**Index:** [`Bank-DBO-Sprint-Index.md`](./Bank-DBO-Sprint-Index.md)  
**Edition:** [`docs/editions/bank-dbo.yaml`](../editions/bank-dbo.yaml)  
**Apps:** `era-bank-dbo`

---

## Scope

### In scope

- Digital banking channel BFF + retail/corporate customer UI over `era-bank-core` `banking_dbo`
- No local ledger; balances/money via engine
- OTP auth; ASAN/SİMA **stub** labeled until YC-E3
- Transfers, payment orders, corporate multi-signatory queue (lab)

### Out of scope

- Live ASAN/SİMA certification; live payment rails (parent CERTIFICATION-TRACK)
- Product ga without Pilot field
- Parent CAP-* **OUT** modules (trade finance, custody, wealth, …) — DBO must not imply them
- Full Open Banking / PFM / H2H (see Capability Inventory §10)

---

## Definition of Done (soft / scaffold)

- [ ] Unit / golden / integration tests for changed surface
- [ ] Stage-gate signoff under `reports/`
- [ ] Implementation-Matrix row updated (✅ only per canon §3.2)
- [ ] Product-Readiness-Matrix columns updated if UI/Demo/Pilot touched
- [ ] Parent Capability Inventory touched if channel expands claimed CBS surface
- [ ] COVERAGE_MATRIX actor row(s) updated when applicable
- [ ] `npm run check:acceptance` PASS

## Definition of Done (pilot / GA)

- [ ] Pilot lab checklist signed
- [ ] Field AC not Scaffold ✅ until field proof
- [ ] Edition yaml `ga` only after `pilot_ready: true` + Pilot field

## Gate script

```bash
node scripts/run-bank-dbo-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Channel AC ✅ ≠ full commercial digital bank or full ABS  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
- **AC-DBO-OPEN:** stays Scaffold 🟡 **in** Scaffold BE rollup (curl-only Code stretch, not vendor). Product-Readiness Scaffold BE **🟡**. Playbook: [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md). ≠ OPEN ✅ / full Open Banking UAT
