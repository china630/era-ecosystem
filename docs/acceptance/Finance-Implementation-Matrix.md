# Finance — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Finance-Product-Readiness-Matrix.md`](./Finance-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-FIN-GL | GL / NAS / journal posting | 🟡 | [ ] | DELIVERY finance GL; event worker |  |
| AC-FIN-ARAP | AR/AP invoices + payment/netting | 🟡 | [ ] | Finance invoice SoT |  |
| AC-FIN-INV | Inventory + stock/GL atomicity | 🟡 | [ ] | DELIVERY inventory |  |
| AC-FIN-HR | HR payroll depth + MDM person read-through | 🟡 | [ ] | FIN-HR-*; COVERAGE API on depth rows | API ≠ UI ready — Scaffold 🟡 |
| AC-FIN-TAX | Tax / Goskomstat statforms | 🟡 | [ ] | FIN-STAT-01 API |  |
| AC-FIN-FA | Fixed + intangible assets | 🟡 | [ ] | FIN-FA-LC-01, FIN-IA-01 API |  |
| AC-FIN-EVT | Satellite event ingress → accounting dispatch | 🟡 | [ ] | @era/contracts; SatelliteEventDispatchService | HEADLESS contour |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs).  
Do not call this table «product readiness».
