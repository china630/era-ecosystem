# Vision — ERA Construction

Site ops for construction projects: BOQ, progress acts, field logs, drawings metadata, schedule, equipment hours, requisitions, subcontractor claims.

**Plane ownership (fixed):** [construction-domain-boundaries.md](../../../docs/adr/construction-domain-boundaries.md)

| In this satellite | Not in this satellite |
|-------------------|------------------------|
| Project, field, ops CDE, BOQ/acts as operational packs | GL, invoices, payments, commercial contracts → **Finance** |
| Site hours / equipment as project fact | Attendance SoR / payroll → **CP** (+ Finance mirror) |
| Optional link after sale | Lead → convert → payment path → **CRM** then **Finance** |

Event: `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED` → Finance WIP/AR.
