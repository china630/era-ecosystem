# Hotel — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Hotel-Product-Readiness-Matrix.md`](./Hotel-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Hotel-Implementation-Matrix.md`](./Hotel-Implementation-Matrix.md)  
**Evidence:** [`Hotel-Evidence-Rules.md`](./Hotel-Evidence-Rules.md)  
**Index:** [`Hotel-Sprint-Index.md`](./Hotel-Sprint-Index.md)  
**Edition:** [`docs/editions/hotel.yaml`](../editions/hotel.yaml)  
**Apps:** `era-hotel-pms`

---

## Scope

- In scope: FO screen chain, cash/city ledger MVP, HK, rates, guest MDM, Nafta ops
- Out of scope: Opera-depth AR, live NBC KKM, door locks field certification
- **Declared, not built:** early checkout unused-nights refund (net of 18% VAT, default CASH) — [hotel-early-checkout-unused-nights.md](../adr/hotel-early-checkout-unused-nights.md) (HOT-CO-04 STUB; not H-BL-09 hour fees)
- **Declared spec (not SHIPPED):** Management Reports catalog + nightly ZIP — [`era-hotel-pms/doc/MANAGEMENT-REPORTS-CATALOG.md`](../../era-hotel-pms/doc/MANAGEMENT-REPORTS-CATALOG.md) (HOT-RPT-01/02 API/SCREEN; out of Scaffold BE rollup)
- **Declared spec (not SHIPPED):** Nafta housekeeping deepen — SCREEN engineering ([`HK-NAFTA-OPS.md`](../../era-hotel-pms/doc/HK-NAFTA-OPS.md) · UAT-SMOKE §34). `AC-HOT-HK` scaffold ✅ is Dirty/Clean/Inspected only.
- **Declared, not this edition:** SHARED hotel pool and automated topology migrate — [deployment-topology.md](../adr/deployment-topology.md). Waves 3–5: tenant roots + kit filter (CP-TENANT-01 API / AC-HOT-TENANT 🟡); Nafta hotel = DEDICATED/ONPREM. Mix (hotel DEDICATED + clinic SHARED) is a future sales shape, not the pilot default.

## Definition of Done (soft / scaffold)

- [ ] Unit / golden / integration tests for changed surface
- [ ] Stage-gate signoff under `reports/`
- [ ] Implementation-Matrix row updated (✅ only per canon §3.2)
- [x] Product-Readiness-Matrix columns updated if UI/Demo/Pilot touched
- [ ] COVERAGE_MATRIX actor row(s) updated
- [ ] `npm run check:acceptance` PASS

## Definition of Done (pilot / GA)

- [ ] Pilot lab checklist signed
- [ ] Field AC not Scaffold ✅ until field proof
- [ ] Edition yaml `ga` only after `pilot_ready: true` + Pilot field

## Gate script

```bash
node scripts/run-hotel-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
