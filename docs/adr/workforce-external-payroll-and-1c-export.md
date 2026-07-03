# ADR: Workforce external payroll and 1C CSV export

**Status:** Accepted (Plan F)  
**Date:** 2026-06-16

## Context

Nafta pilot runs hotel/clinic ops with **1C accounting** and optional Finance HR. CP Workforce (Plans A–E) must operate with **zero Finance** while supporting monthly payroll handoff.

## Decision

| Entitlement | Workforce | Payroll | Export |
|-------------|-----------|---------|--------|
| `platform_workforce` | CP full | — | CSV download |
| + `hr_full` | same | Finance mirror | Finance + optional CSV |

- Export API: `GET /platform/v1/workforce/export/{roster|absences|timesheet}` — **HEADLESS** MVP (CSV only, no 1C HTTP).
- Default export: `globalPersonId` + MDM ops display name — **no FIN** column.
- FIN export requires separate compliance-identity grant (future).

## UI

`/workspace/workforce/export` — OrgOwner/HR download buttons.

## Related

- [cp-core-workforce-hub.md](./cp-core-workforce-hub.md)
- [NAFTA_SANATORIUM_UAT.md](../NAFTA_SANATORIUM_UAT.md) §7
