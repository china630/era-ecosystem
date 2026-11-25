# ADR: Construction smeta rate engine (norms / расценки) MVP

**Status:** Accepted (MVP landed 2026-11-20) — AC 🟡 until field UAT  
**Coverage:** Rate bases + calc → estimate lines · **Construction SKU** (not a separate satellite)

**Related:**

- [construction-estimate-hierarchy.md](./construction-estimate-hierarchy.md) — five-level pack (structure + approval; no DESN engine in v1)
- [construction-domain-boundaries.md](./construction-domain-boundaries.md) — money stays Finance
- [era-commercial-catalog.md](./era-commercial-catalog.md) — planned SKU `construction_smeta_rate_engine`
- [data-hub-construction-materials.md](./data-hub-construction-materials.md) — nomenclature (not rates)

---

## Context

Ops estimate pack (CN-EST-01) stores **already calculated** lines (manual / CSV / import). Users asked for a **full norms-and-rates calculator** (DESN-class / GrandSmeta-like). That was deferred from estimate hierarchy v1 so Construction did not absorb a second product.

**Placement question:** is the engine “in Construction”? **Yes as a product SKU and domain owner** — not a new deployable satellite and not Data Hub. Bases + calc APIs live under `era-construction` (or a library owned by that app). Estimate hub **consumes** engine output into `EstimateLine` / BOQ. Finance never owns DESN content.

---

## Decision

### D1 — Product home = Construction addon SKU

| | |
|--|--|
| **SKU (planned)** | `construction_smeta_rate_engine` (list price TBD; catalog seed later) |
| **Gate** | Requires `industry_construction`; complements `construction_estimate_hierarchy` / `construction_boq` |
| **Deploy** | Same Construction process/DB (SHARED default); no new `era-smeta` service in MVP |
| **Not** | Data Hub catalog; Finance ledger; org BudgetYear |

### D2 — MVP scope (first shippable slice)

**In:**

1. Org-owned **rate base** version (`RateBase` / `RateItem`: labor / material / machine composition, unit, base amount).
2. Calc API: quantity + rate item → **resource breakdown + amount** → push into Estimate LCR/SC lines (or draft lines for user confirm).
3. UI: admin rate-base CRUD + “apply rate” on Estimate leaf docs.
4. Entitlement gate on calc/mutate when SKU off.

**Out of MVP (later content / product):**

- Full licensed DESN/ГЭСН/ФЕР national databases and index engines.
- Competing with GrandSmeta as a standalone desktop replacement.
- Auto-GL from rates (Finance still via estimate approve → SOV / acts).

### D3 — Materials vs rates

- **Material nomenclature / optional list prices** → Data Hub ([data-hub-construction-materials.md](./data-hub-construction-materials.md)).
- **Norms of consumption + work rates** → this engine (may **reference** hub material codes).

### D4 — Acceptance honesty

- New COVERAGE id (e.g. CN-SMETA-ENGINE-01) when code lands; AC 🟡 until negatives + UAT.
- No edition `ga` / Pilot from this ADR alone.
- Estimate hierarchy ADR consequence “DESN out of v1” remains true until this SKU ships MVP.

---

## Consequences

- Commercial catalog gains a **declared** Construction add-on (seed when implementation starts).
- Construction PRD/TZ gain M21 (or deepen M20) when wave opens.
- Import path (CSV / external GrandSmeta) stays valid forever as alternative to engine.

## References

Debt queue: [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md) § P0 platform / construction debts  
Plan: [`.cursor/plans/smeta-budget-materials-ecosystem.plan.md`](../../.cursor/plans/smeta-budget-materials-ecosystem.plan.md)
