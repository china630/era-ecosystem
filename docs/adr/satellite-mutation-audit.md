# ADR: Satellite mutation audit trail

**Status:** Accepted  
**Date:** 2026-06-13  
**Related:** Finance `AuditMutationInterceptor` · [era-common-laws.mdc](../../.cursor/rules/era-common-laws.mdc)

## Context

Finance Core logs mutations globally via `AuditMutationInterceptor`. Industry satellites (hotel, FB, clinic) need an equivalent **immutable audit row** for high-risk operations: folio void, discounts, master-data retire/delete.

Clinic already has domain-specific `VisitDiscountAudit`; hotel/FB had no unified pattern.

## Decision

1. Shared helper in `@era/satellite-kit`: `recordSatelliteAudit`, `redactAuditChanges`, `SatelliteAuditInput`.
2. Identical Prisma model `SatelliteAuditLog` in each satellite DB (deployment = one org; no `organizationId` column).
3. Wire on first wave: folio charge void, ticket line void, visit discount, master-data DELETE/PATCH retire.
4. Read API: `GET /api/audit?entityType=&entityId=` (authenticated, reports permission).

## Model

| Field | Purpose |
|-------|---------|
| `userId` | Local ops user id from session |
| `entityType` | e.g. `FolioCharge`, `TicketLine`, `Visit`, `RoomType` |
| `entityId` | Primary key of affected row |
| `action` | e.g. `VOID`, `DISCOUNT`, `UPDATE`, `DELETE` |
| `changesJson` | Redacted before/after snapshot |
| `ipAddress` | Request IP when available |

PII keys (`password`, `passport`, `fin`, `phone`, `email`) are redacted in `changesJson`.

## Consequences

- Satellites remain autonomous; audit is local DB, not orchestrator-centralized (export to SIEM later if needed).
- Finance audit pattern unchanged; cross-module compliance NFR satisfied per satellite.
