# ADR: Construction domain boundaries (Finance / CP / CRM)

**Status:** Accepted  
**Date:** 2026-11-17  
**Coverage:** Construction product depth · cross-plane ownership (no plane move)

**Related:**

- [era-architecture-boundaries.mdc](../../.cursor/rules/era-architecture-boundaries.mdc) — three planes
- [satellite-finance-bridge-pattern.md](./satellite-finance-bridge-pattern.md) — progress act → Finance
- [workforce-timesheet-construction-bridge.md](./workforce-timesheet-construction-bridge.md) — attendance SoR on CP
- [construction-domain-permissions-and-rbac.md](./construction-domain-permissions-and-rbac.md) — Variant A grants
- [crm-lead-party-model-and-prospect-import.md](./crm-lead-party-model-and-prospect-import.md) — lead → Finance convert
- App: [`era-construction/PRD.md`](../../era-construction/PRD.md) · Finance PRD §4.15–4.16 · CRM PRD §1

---

## Context

Market research (Procore, ACC, Oracle, Buildertrend, Fieldwire) lists a full stack in one product: CRM, contracts, GL-style cost, payroll-adjacent time, field ops, CDE. ERA already splits that stack across planes. This ADR records **ownership only**. It does **not** move money into the construction satellite, HR into construction, or site ops into Finance/CRM.

Architecture stays fixed:

| Plane | Owns |
|-------|------|
| **Finance** (`era-finance-core`) | GL, AR/AP, procurement, commercial contracts, counterparties, invoices, payments, WIP journals from satellite events |
| **Control plane** (`era-orchestrator`) | Identity launcher, entitlements, workforce / timesheet SoR, staff provisioning where wired |
| **CRM** (`era-crm`) | Pre-sale: lead → qualify → visit → convert (to payment / counterparty handoff) |
| **Construction** (`era-construction`) | Site business ops for an entitled org: project, field, drawings ops, BOQ/acts as **operational** records |

---

## Decision

### D1 — Fixed plane map (research → ERA)

| Capability (market language) | ERA owner | Construction may hold |
|------------------------------|-----------|------------------------|
| Lead, proposal, selections sales cycle | **CRM** | Link/ref only after convert (optional later) |
| Counterparty MDM, VÖEN, commercial `Contract` / amendments / commitments | **Finance** | Optional `financeContractId` / counterparty ref on project or act |
| Invoices, payments, Procore Pay / Textura-class payouts | **Finance** (+ platform pay links) | Trigger via approve event; no ledger |
| Org annual / gov budget | **Finance** §4.16 | — |
| Attendance month grid, payroll mirror | **CP** → Finance (bridge ADR) | CSV / site hours import upsert into CP; local `TimesheetEntry` is site fact, not payroll SoR |
| Project, locations, stages | Construction | Source of truth for the site |
| Project parties (GC / sub / owner as **participants**) | Construction | Ops party rows; money identity stays Finance counterparty |
| BOQ / cost codes as **site WBS** | Construction | Operational codes + plan qty/amount; not GL accounts |
| Five-level estimate pack (ЛСР→ОСР→СР→ССР→сводка) | Construction ops | Dual mode per project (`FLAT_BOQ` \| `ESTIMATE_HIERARCHY`); ADR [construction-estimate-hierarchy](./construction-estimate-hierarchy.md); approve → BoqLine; Finance SOV seed via `SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED` (`seedSovFromEstimatePackage`, no auto-GL) |
| Smeta rate engine (norms / расценки) | Construction ops (**SKU** `construction_smeta_rate_engine`, debt) | Org rate bases + calc → Estimate lines; not Data Hub; not org BudgetYear — [construction-smeta-rate-engine.md](./construction-smeta-rate-engine.md) |
| Construction materials nomenclature | Data Hub (sketch debt) | Shared SKU/UoM; industry via Platform Gateway — [data-hub-construction-materials.md](./data-hub-construction-materials.md) |
| Org year budget + execution (commercial + B2G) | Finance | §4.16 deepen; commercial management budget — [finance-commercial-budget-execution.md](./finance-commercial-budget-execution.md) |
| Progress act / KS-style billing pack | Construction ops → event | Header + lines; Finance posts WIP/AR (and later invoice) |
| Change events / field change requests | Construction ops | Commercial CO / commitment amendments that change money → Finance contract path |
| Daily log, punch/issue, RFI, submittals (ops) | Construction | — |
| Drawings / sheet revisions (ops CDE) | Construction | Full partner CDE certification remains edition-scoped |
| Gantt / CPM site schedule | Construction | — |
| Equipment hours on site | Construction | Cost allocation narrative only; no GL |
| Material requisition on site | Construction | PO / stock / pay → Finance |
| Subcontractor **claim** pack on site | Construction | Payable / contract settle → Finance |
| Public customer webhooks / Open API product | Platform pattern (orch bus today) | Domain events in `@era/contracts`; customer-facing webhook product is a **separate** ADR if sold |
| Soft-delete / audit | Construction + kit audit belt | Align with mutation-audit ADR; no cross-party hard wipe of others' ops rows when parties exist |

### D2 — Money and HR never relocate

1. **Do not** implement PrimeContract / Commitment / PayApplication **ledgers**, budget committed/actual **as accounting truth**, or payment rails inside `era-construction`.
2. **Do not** make construction the attendance or payroll SoR (CP bridge remains).
3. **Do not** rebuild lead pipeline or invoice UI in construction (CRM + Finance already own convert → counterparty / draft invoice).
4. Construction **may** deepen operational models (act lines, cost codes, parties, RFI, richer daily log, sheet pins) and emit richer `SATELLITE_*` payloads for Finance consumers.

### D3 — CRM ↔ Construction handoff

- Pre-sale and "to the point of payment" = **CRM → Finance** (`SATELLITE_CRM_LEAD_CONVERTED`).
- Site work starts in **construction** after the org has a project (manually or via a future optional link from won lead / Finance contract). That link is additive; it is not a reason to put CRM screens in construction.
- Buildertrend-style "lead → warranty in one app" is **split** across CRM + Finance + Construction (+ CP for labor).

### D4 — Event contract naming

Canonical construction → Finance milestone:

`SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED`

(`@era/contracts` `construction.events.ts`). Older shorthand without `_ACT_` in bridge docs is a typo; use the canonical name.

### D5 — Depth roadmap (construction only)

Owned by `era-construction` PRD / DELIVERY (status honesty: MODULES_CATALOG DONE ≠ Pilot / GA):

1. Progress act **lines** (ops SOV) tied to BOQ / cost code → richer approve payload
2. Project **parties** (participant + role; Finance counterparty ref)
3. Drawing / sheet revision lifecycle events
4. Punch pin-to-sheet, richer daily log
5. RFI / submittals (ops)
6. Change **request** ops pack (money settlement stays Finance)
7. Domain event catalog expansion in contracts + Finance/CP consumers as needed

RBAC company-scope / hide-finance fields = later amendment to the RBAC ADR (Variant A today has no `scope:*`).

---

## Consequences

- Product and agent work maps market features onto **existing** planes; gaps for site ops land in construction.
- Finance deepens consumers and commercial contract links; it does not host daily logs or punch lists.
- CRM documents construction as a **vertical use** of the same lead→convert path; no duplicate construction CRM module.
- Acceptance / COVERAGE updates follow depth waves; do not claim SHIPPED or edition `ga` from this ADR alone.
- **Billing:** ops SKUs stay under `industry_construction` (`construction_boq`, schedule, CDE, depth, …). PayApp / KS-2·3 print is Finance `contract_payapp_ks`; tenders are Finance `procurement_tenders_pro`. Legacy `construction_boq_ks` is retired — [era-commercial-catalog.md](./era-commercial-catalog.md) § Decision 7.
- **Landed (2026-11-18):** Finance `ContractAmendment` + PayApplication/KS print + tender award; CRM SelectionPackage/WarrantyCase; construction BIM-lite refs on punch/RFI. Ops change APPROVED_OPS may draft a Finance amendment when `financeContractId` is set — never auto-GL.

## Acceptance

1. This ADR linked from construction PRD / clone-spec boundaries and Acceptance System scope.
2. New construction money-like tables require an explicit "ops only + Finance event" note in the same PR.
3. `npm run check:acceptance` stays green when matrices touch sell/show.
