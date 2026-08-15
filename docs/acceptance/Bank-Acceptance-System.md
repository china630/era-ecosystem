# Bank — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Bank-Product-Readiness-Matrix.md`](./Bank-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Bank-Implementation-Matrix.md`](./Bank-Implementation-Matrix.md)  
**Capability / scope boundary SSOT:** [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md)  
**Evidence:** [`Bank-Evidence-Rules.md`](./Bank-Evidence-Rules.md)  
**Index:** [`Bank-Sprint-Index.md`](./Bank-Sprint-Index.md)  
**Edition:** [`docs/editions/bank.yaml`](../editions/bank.yaml)  
**Apps:** `era-bank-core`, `era-bank`  
**Certification (live/external):** [`era-bank/doc/CERTIFICATION-TRACK.md`](../../era-bank/doc/CERTIFICATION-TRACK.md)

---

## Scope

### In scope (Full commercial AZ CBS program)

- Kernel L1: CBAR GL, posting, CIF/MDM link, accounts, EOD/EOM, Product Factory, branches/МФР
- L2 modules: deposits, loans, cards, payments, AML, treasury, regreporting, risk (lab), ops satellite UI
- Channel product line: Bank DBO (separate Acceptance System)

See PRD [`era-bank-core/PRD.md`](../../era-bank-core/PRD.md) §4 and Capability Inventory §1–5, §8–10 for CAP-* **IN/PARTIAL/DECLARED**.

### Out of scope (explicit — not sold with Bank mvp)

Tracked as CAP-* **OUT** in [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md), including at least:

- Trade finance (LC, guarantees, documentary collections, SCF)
- Custody / CSD / brokerage / asset management / private banking & wealth
- Derivatives and capital-markets front office (beyond treasury basics)
- Full credit factory: decision engine, lines/revolvers, syndication, leasing, factoring, microfinance, collections/recovery factory
- Real-time fraud engines; Islamic banking; own ATM/card scheme; multi-entity holding CBS
- Enterprise MIS/BPM/DMS, relationship pricing suites, safe deposit box

### Parallel certification (DECLARED live — not edition ga)

YC-E1…E7: live rails, cards, ASAN/MDM, AKB+certified ECL, FMN/CBAR/sanctions, pentest/HA, Pilot field — see CERTIFICATION-TRACK. Do not mark COVERAGE SHIPPED for live while ⏸.

---

## Definition of Done (soft / scaffold)

- [ ] Unit / golden / integration tests for changed surface
- [ ] Stage-gate signoff under `reports/`
- [ ] Implementation-Matrix row updated (✅ only per canon §3.2)
- [ ] Product-Readiness-Matrix columns updated if UI/Demo/Pilot touched
- [ ] Capability Inventory updated if scope boundary changed (IN/PARTIAL/DECLARED/OUT)
- [ ] COVERAGE_MATRIX actor row(s) updated
- [ ] `npm run check:acceptance` PASS

## Definition of Done (pilot / GA)

- [ ] Pilot lab checklist signed
- [ ] Field AC not Scaffold ✅ until field proof
- [ ] Edition yaml `ga` only after `pilot_ready: true` + Pilot field
- [ ] Live CAP-* DECLARED only with YC-E evidence (no stub-as-SHIPPED)

## Gate script

```bash
node scripts/run-bank-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready ≠ «полный коммерческий банк»
- In-scope AC all ✅ ≠ CAP-* OUT capabilities included
- Do not write «all ✅» while any **in-scope** AC or Readiness layer is 🟡/❌
- MODULES_CATALOG DONE ≠ edition `ga`
- Answer sell/show from Product-Readiness + Capability Inventory OUT list — never from AC green alone
