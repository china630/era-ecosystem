# ADR: Workforce job architecture (four axes)

**Status:** Accepted (deferred implementation)  
**Date:** 2026-10-29  
**Products:** `era-orchestrator` (CP workforce)  
**Related:** [cp-workforce-org-units.md](./cp-workforce-org-units.md) · [cp-workforce-hr-routes.md](./cp-workforce-hr-routes.md) · [cp-workforce-floor-attendance.md](./cp-workforce-floor-attendance.md)

## Context

Operators confuse **org-unit nesting** with **who ranks above whom** and with **how valuable a job is**. Buffet management eaters, advance routes, and future pay bands need clear vocabulary. Advanced HRIS (Oracle HCM, SAP SuccessFactors, Workday, Deloitte job-architecture practice) keep these as separate axes.

## Decision

ERA documents **four axes**. Do not collapse them into the OrgUnit tree alone.

| Axis | Meaning | ERA today |
|------|---------|-----------|
| **Job / grade / level** | Catalog of roles + numeric level (L1–L7 / grade bands) for job value, pay band, career path | **Not implemented** (deferred; CORP non-goal for full grades/KPI/talent) |
| **Position** | Slot in a unit; references the job (when job catalog exists) | `WorkforcePosition` — name, slots, `leadership`, tariff/hours |
| **Org unit tree** | Legal / cost-center nesting | `OrgUnit` with `parentId` |
| **Reporting hierarchy** | Who manages this employment; may diverge from the unit tree | `OrgUnit.managerEmploymentId` (+ employment links); not a full people graph |

**Operational rule flags** (e.g. `WorkforcePosition.leadership`) are allowed **without** a full grade catalog. Buffet “management eaters” seed from `leadership === true` plus an include/exclude roster — not from OrgUnit depth.

## Consequences

- Prefer `leadership` / future job-level codes for eligibility rules; do not infer rank from tree depth.
- Full job architecture (job family, grade codes, pay structures) is a **later Workforce wave**, not an F&B buffet blocker.
- Finance `JobPosition` remains a CostCenter mirror; salary bands stay on the Finance mirror until CP owns grades.

## Non-goals (this ADR)

- Implementing L1–Ln catalogs in this change
- Merging dual-VÖEN org trees (see [evrostar-workforce-pilot.md](./evrostar-workforce-pilot.md))
