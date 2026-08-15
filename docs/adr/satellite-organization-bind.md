# ADR — Satellite organization bind

**Status:** Accepted  
**Date:** 2026-08-15

## Context

Industry satellites historically resolve tenancy from `ERA_SATELLITE_ORGANIZATION_ID` (or aliases) baked into `.env` / compose and restarted after onboarding. That is fragile for on-prem / appliance installs (Nafta and similar): Super-admin creates the org and departments in Orchestrator, then ops must hand-copy UUIDs into each satellite container.

## Decision

1. **Orchestrator remains SoR** for org graph, Connect/subscription, and `SatelliteEndpoint` base URLs.
2. Each **industry satellite** exposes an authenticated internal bind API:
   - `POST /api/internal/v1/organization/bind` — set deployment org UUID
   - `GET /api/internal/v1/organization/bind` — current binding
   - Auth: `Authorization: Bearer` matching `SATELLITE_EVENT_SERVICE_TOKEN` (same family as event ingest).
3. Binding is persisted **inside the satellite** (runtime memory + optional Postgres `_era_organization_bind` + file cache) so it survives restart without editing host `.env`.
4. Env `ERA_SATELLITE_ORGANIZATION_ID` remains a **bootstrap / override**: if set at process start it still works; bind updates runtime + `process.env` for request-time reads.
5. Orchestrator Super-admin can **fan-out** bindings:
   - `POST /v1/admin/orgs/:orgId/sync-satellite-bindings`
   - Uses registered enabled endpoints; department-owned endpoints bind that department UUID; parent-registered F&B/Clinic/Retail endpoints may resolve to a matching child department by name heuristic.
6. **Not in scope:** docker.sock, mutating compose from orch, Finance Core multi-org binding, bank cores.

## Resolution order (`satelliteOrganizationId()`)

1. Runtime bind (memory, set by POST bind)
2. File cache (`ERA_ORG_BIND_FILE` or `.data/organization-bind.json`)
3. `ERA_SATELLITE_ORGANIZATION_ID` / `ORGANIZATION_ID`
4. Fallback `demo-org` (non-production smoke only)

DB row is loaded on bind GET/POST and when handlers hydrate; prefer calling kit helper rather than caching org id in module-level `const`.

## Consequences

- Happy path after Connect: set satellite endpoint URLs → **Sync satellite bindings** on org hub — no manual `.env` UUID copy.
- Images older than this ADR need rebuild/redeploy before Sync works.
- Call sites that capture `process.env.ERA_SATELLITE_ORGANIZATION_ID` at **module import** still need a process restart after first bind, or migration to `satelliteOrganizationId()`.
