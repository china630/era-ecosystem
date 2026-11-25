# ADR: Finance commercial budget + execution trace (debt)

**Status:** Accepted (MVP landed 2026-11-20) — AC 🟡 until field UAT  
**Coverage:** Org planning budget for **COMMERCIAL** (and deepen B2G) · plan vs fact · commitment → cash

**Related:**

- Finance PRD §4.16 (BudgetYear / `gov_budget_pro` — Phase A for `OrganizationKind.BUDGET`)
- [construction-domain-boundaries.md](./construction-domain-boundaries.md) — object BOQ/acts ≠ org year budget
- [construction-smeta-rate-engine.md](./construction-smeta-rate-engine.md) — object rates, not org budget

---

## Context

B2G annual budget (`/gov-budget`, entitlement `gov_budget_pro`) exists for **BUDGET** orgs. PRD already states **COMMERCIAL** should get an optional **management budget** on the same engine with simpler articles — that path is thin / not sellable as a commercial planning product.

Many commercial customers already plan budgets and need **execution tracing** (limit → obligation → payment/act → GL fact), not only government NAS-Gov chapters.

---

## Decision

### D1 — Same Finance plane, two article modes

| Mode | Org kind | Articles | Entitlement (existing / extend) |
|------|----------|----------|----------------------------------|
| Gov | `BUDGET` | NAS-Gov chapters | `gov_budget_pro` (deepen) |
| Management | `COMMERCIAL` (opt-in) | Simplified / custom chart of budget items | Same engine; SKU name TBD (`mgmt_budget_pro` or extend `gov_budget_pro` with mode) |

Do **not** put org year budget in Construction.

### D2 — Execution trace (debt MVP)

1. **Plan:** `BudgetYear` + lines (annual + optional monthly).
2. **Reserve:** link `ContractCommitment` / PO / purchase / construction act refs to budget line (soft then hard gate).
3. **Fact:** plan vs actual from GL (and/or documented commitment consume) with drill-down.
4. **UI:** commercial org can open budget workspace without pretending to be BUDGET kind.

### D3 — Bridges (later)

- Construction estimate approve / progress act → optional consume against **project-coded** budget lines when `financeContractId` / project code set.
- No DESN content in Finance.

### D4 — Acceptance

- Track as Finance debt / AC residual (e.g. deepen AC around §4.16); no Scaffold ✅ / Pilot until UAT.
- Does not flip Finance Demo ❌ → ✅ by docs alone.

---

## Consequences

- OPEN-TASKS + roadmap carry explicit **commercial** budget debt (not “B2G only”).
- M6 roadmap item stays the umbrella until wave closes.

## References

[era-finance-core/docs/OPEN-TASKS.md](../../era-finance-core/docs/OPEN-TASKS.md)  
[DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md)  
Plan: [`.cursor/plans/smeta-budget-materials-ecosystem.plan.md`](../../.cursor/plans/smeta-budget-materials-ecosystem.plan.md)
