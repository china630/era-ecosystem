# ADR: Workforce dual audit (CP vs satellite ops)

**Status:** Accepted (Plan F)  
**Date:** 2026-06-16

## Context

CP `WorkforceAuditLog` and satellite mutation audit serve different forensics needs.

## Decision

- **CP:** `WorkforceAuditLog` — hire, terminate, absence approve, role grant, `SEAT_DENY`, timesheet approve. Columns: `workforceScopeId`, `globalPersonId`, `cpEmploymentId`.
- **Satellites:** existing ops audit unchanged (folio void, clinic charges).
- **Correlation:** `@era/satellite-kit` `stampWorkforceAuditContext(session)` adds optional `cpEmploymentId` / `globalPersonId` to satellite audit `changes`.
- **UI:** `/workspace/workforce/security/audit` — CP filter only; deep link to satellite ops audit documented, no table merge.
- **PlatformAuditLog** (billing) — separate; cross-link in docs only.

## Related

- [cp-workforce-role-templates-and-security-admin.md](./cp-workforce-role-templates-and-security-admin.md)
