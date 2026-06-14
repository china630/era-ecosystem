# ADR: Tenancy and Outlet Boundaries

**Status:** Accepted  
**Date:** 2026-06-05  
**Related:** [org-operating-mode.md](./org-operating-mode.md)

## Context

ERA deployments span multiple legal entities, department satellites, and multiple points of sale within one VOEN. Teams need a single rule set for when to model boundaries as `Outlet`, `DEPARTMENT`, or `STANDALONE`.

## Decision

| Need | Mechanism | Money / fiscal |
|------|-----------|----------------|
| Multiple POS terminals (bar + restaurant), same VOEN | Multiple `Outlet` rows in one satellite DB | Fiscalize locally via `fiscalizeForSatellite` unless `shouldFiscalizeOnParent` |
| Clinic / shop as hotel department | Orchestrator org `DEPARTMENT` + `parentOrgId` | Revenue routes to parent; B2C pay honors parent fiscal gate |
| Separate legal entity | `STANDALONE` org with unique VOEN | Own fiscal registration and GL |

### Outlet (in-satellite)

- Use when one purchased satellite deployment serves several physical points of sale under the **same** organization and VOEN.
- Examples: F&B outlets, retail registers, hotel revenue centers.
- Staff operational login remains **local satellite auth** (PIN / local user), not org picker SSO.

### DEPARTMENT (cross-deployment)

- Use when a satellite runs as a **department** of a parent org (e.g. hotel clinic, hotel retail).
- Orchestrator stores `operatingMode=DEPARTMENT`, `parentOrgId`, and routing flags (`fiscalRouting`, `revenueRouting`).
- Satellite events and B2C pay paths must call `shouldRouteRevenueToParent` / `shouldFiscalizeOnParent` before posting revenue or fiscal receipts.

### STANDALONE

- Default for an independent VOEN and full org subscription.
- No parent money routing; department satellites must not double-fiscalize parent receipts.

## Implementation references

- Operating mode service: `era-orchestrator/apps/api/src/admin/org-operating-mode.service.ts`
- Fiscal gate: `@era/satellite-kit` `fiscalizeForSatellite`, `shouldFiscalizeOnParent`
- F&B pay (department-safe): `era-fnb-pos/app/api/tickets/[id]/pay/route.ts`

## Consequences

- New satellites with multiple POS surfaces should add `Outlet` first; do not create a second org for the same VOEN.
- Department deployments must register `SatelliteEndpoint` on the orchestrator and honor parent routing helpers on every B2C pay path.
