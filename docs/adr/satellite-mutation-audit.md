# ADR: Satellite mutation audit trail

**Status:** Accepted (storage + first-wave wiring)  
**Date:** 2026-06-13  
**Amended:** 2026-10-27 — coverage and HTTP belt rules moved to the ecosystem standard  
**Superseded-in-part-by:** [era-mutation-audit-standard.md](./era-mutation-audit-standard.md) (Layer A automatic belt, “100%” definition, performance, rollout)  
**Related:** Finance `AuditMutationInterceptor` · [era-common-laws.mdc](../../.cursor/rules/era-common-laws.mdc) · [era-mutation-audit-standard.md](./era-mutation-audit-standard.md)

## Context

Finance Core logs mutations globally via `AuditMutationInterceptor`. Industry satellites (hotel, FB, clinic) need an equivalent **immutable audit row** for high-risk operations: folio void, discounts, master-data retire/delete.

Clinic already has domain-specific `VisitDiscountAudit`; hotel/FB had no unified pattern.

This ADR remains the **satellite storage and helper** contract. Ecosystem-wide coverage (automatic Layer A on every mutation, domain enrich catalog, deny-list, CI) is defined in [era-mutation-audit-standard.md](./era-mutation-audit-standard.md). Opt-in service calls alone are **not** full coverage.

## Decision

1. Shared helper in `@era/satellite-kit`: `recordSatelliteAudit`, `redactAuditChanges`, `SatelliteAuditInput`.
2. Identical Prisma model `SatelliteAuditLog` in each satellite DB. Tenant roots + audit carry `organizationId` (CP-TENANT-01 API). Kit filter is **fail-closed** (no `unbound` default). Live SHARED pool / field two-org UAT still open. Indexes: `(entityType, entityId)`, `createdAt`, `organizationId`, and Wave E compound `(organizationId, createdAt)` for org journal lists (Hotel/Clinic/F&B). Per-row `integrityHash` only — org hash-chain deferred (Finance remains reference).
3. Wire on first wave: folio charge void, ticket line void, visit discount, master-data DELETE/PATCH retire. **Follow-up:** HTTP mutation belt per [era-mutation-audit-standard.md](./era-mutation-audit-standard.md) (Hotel first).
4. Read API (canon): UI `/admin/audit` → `GET /api/admin/audit?entityType=&entityId=&action=&dateFrom=&dateTo=&userId=` (authenticated; hotel = reports permission). See [era-mutation-audit-standard.md](./era-mutation-audit-standard.md) § Org audit UI. Legacy `/api/audit` and `/settings/audit` are removed (no redirect).

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

Hotel reservation stay journal reuses this table (`entityType=Reservation`, `entityId=reservationId`). Writers go through `recordReservationAudit` / `recordReservationDiff` (`era-hotel-pms/src/lib/reservation-audit.ts`). The card UI is a viewer (event list + labeled field diff); do not add a second stay-log table. That journal is **Layer B** under the ecosystem standard.

When the HTTP belt lands, Layer A rows use the same table with `entityType=HTTP_MUTATION` and `action` = HTTP method — see [era-mutation-audit-standard.md](./era-mutation-audit-standard.md) § Canonical Layer A row.

## Consequences

- Satellites remain autonomous; audit is local DB, not orchestrator-centralized (export to SIEM later if needed).
- Finance audit pattern unchanged; cross-module compliance NFR satisfied per satellite.
- Claiming SHIPPED / full mutation coverage requires the ecosystem Layer A belt, not only this first-wave wiring.
