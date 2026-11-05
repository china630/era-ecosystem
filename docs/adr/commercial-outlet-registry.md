# ADR: Commercial outlet registry (control plane)

**Status:** Accepted  
**Date:** 2026-11-03  
**Related:** [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md) · [era-commercial-catalog.md](./era-commercial-catalog.md) · [commercial-topology-and-suspend.md](./commercial-topology-and-suspend.md)

## Context

Outlets (F&B cafes, retail registers) live in satellite DBs for menus, tables, and shifts. Control plane only saw capacity gauges (`POS_STATION_MONTHLY`), so owners could not see or suspend points under a satellite, and billing could not explain per-outlet lines.

## Decision

1. **CommercialOutlet** table in orchestrator: `organizationId`, `satelliteKey`, `code`, `name`, `status` (`ACTIVE`|`SUSPENDED`), timestamps; unique `(organizationId, satelliteKey, code)`.

2. **SoT split:** CP owns commercial identity, status, and billable membership. Satellite owns ops rows (menu, tables, caps) keyed by the same `code`.

3. **Create path:** prefer CP create (owner/Structure or platform) then sat materializes ops row; sat-initiated create must call CP assert/register before becoming ACTIVE billable.

4. **Capacity:** `POS_STATION_MONTHLY` / `CAPACITY_DRIVERS` count **ACTIVE** commercial outlets (or sat report filtered to allowlisted ACTIVE codes).

5. **Module mask (phase):** optional per-outlet enable flags subset of org `activeModules`; no separate price list per outlet in v1.

6. Runtime-config / entitlement snapshot includes outlet allowlist + status for the sat to enforce till login.

## Consequences

- Do not create a second Organization per cafe.
- Suspend is not delete; keep audit and fast re-enable.
