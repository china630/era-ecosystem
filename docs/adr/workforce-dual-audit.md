# ADR: Workforce dual audit (CP vs satellite ops)

**Status:** Accepted (Plan F)  
**Date:** 2026-06-16  
**Amended:** 2026-09-17 — full mutation coverage + required person stamps ([evrostar-workforce-pilot.md](./evrostar-workforce-pilot.md))

## Context

CP `WorkforceAuditLog` and satellite mutation audit serve different forensics needs.

## Decision

- **CP:** `WorkforceAuditLog` — every CP workforce **mutation**, not only the Plan F short list (hire, terminate, absence approve, role grant, `SEAT_DENY`, timesheet month approve). Closed `action` catalog. Columns: `workforceScopeId`, `globalPersonId`, `cpEmploymentId` — **required when a person/employment is in scope** (personnel-order rows must stamp these, not only `{ type, orderNumber }`).
- **Must log (pilot holes vs current code):** CSV/xlsx import apply; timesheet autofill / sync-absences / batch cell update (one summary row per batch); `staff-schedule.submit` when not bundled into create; personnel order cancel; personnel-order PDF download.
- **Satellites:** existing ops audit unchanged (folio void, clinic charges).
- **Correlation:** `@era/satellite-kit` `stampWorkforceAuditContext(session)` adds optional `cpEmploymentId` / `globalPersonId` to satellite audit `changes`. Finance payroll money stays on Finance audit, joined by `cpEmploymentId`.
- **UI:** `/workspace/workforce/security/audit` — CP filter only; deep link to satellite ops audit documented, no table merge. Holding HR view filters by union of org ids, not a merged log table.
- **PlatformAuditLog** (billing) — separate; cross-link in docs only.

## Related

- [cp-workforce-role-templates-and-security-admin.md](./cp-workforce-role-templates-and-security-admin.md)
- [evrostar-workforce-pilot.md](./evrostar-workforce-pilot.md)
