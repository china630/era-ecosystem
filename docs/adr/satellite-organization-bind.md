# ADR — Satellite organization bind

**Status:** Accepted  
**Date:** 2026-08-15  
**Updated:** 2026-09-22 (Waves 6–7 — satellite desired-state pull / reconcile)

## Context

Industry satellites historically resolve tenancy from `ERA_SATELLITE_ORGANIZATION_ID` (or aliases) baked into `.env` / compose and restarted after onboarding. That is fragile for on-prem / appliance installs (Nafta and similar): Super-admin creates the org and departments in Orchestrator, then ops must hand-copy UUIDs into each satellite container.

## Decision

1. **Orchestrator remains SoR** for org graph, Connect/subscription, and `SatelliteEndpoint` base URLs.
2. Each **industry satellite** exposes an authenticated internal bind API:
   - `POST /api/internal/v1/organization/bind` — set deployment org UUID
   - `GET /api/internal/v1/organization/bind` — current binding
   - Auth: `Authorization: Bearer` matching `SATELLITE_EVENT_SERVICE_TOKEN` (same family as event ingest).
3. Binding is persisted **inside the satellite** (runtime memory + optional Postgres `_era_organization_bind` + file cache) so it survives restart without editing host `.env`.
4. Env `ERA_SATELLITE_ORGANIZATION_ID` (and bank `ERA_BANK_ORGANIZATION_ID`) remains an **emergency override / bootstrap only**: kit resolution still reads it when runtime/file/db are empty. Prefer Super-admin **Sync** over baking UUIDs into compose. Likewise `CONTROL_PLANE_URL` / `ORCHESTRATOR_URL` on Finance and industry are **bootstrap** for first Sync — live orch URL after Sync is kit `orchestratorEventUrl` / `resolveOrchestratorBaseUrl()`.
5. Orchestrator Super-admin can **fan-out** bindings:
   - `POST /v1/admin/orgs/:orgId/sync-satellite-bindings`
   - Uses registered enabled endpoints; department-owned endpoints bind that department UUID; parent-registered F&B/Clinic/Retail endpoints may resolve to a matching child department by name heuristic.
6. **Scope (updated 2026-08-17):** bank ops BFF (`era-bank`), DBO channel (`era-bank-dbo`), and bank-core Nest expose the same bind contract; Sync fans out `industry_banking`. **Still out:** docker.sock / mutating compose from orch; Finance Core *business* multi-org routing (JWT/membership — Sync bind is a contract only, not appliance single-org).
7. **Next (required):** bind is only the org UUID. Full **desired-state** runtime config (SSO material, event token, edition, topology, public URL) is [deployment-topology.md](./deployment-topology.md) §4 — kill leftover compose/env folklore. Human login alias (`orgNo`) is **not** bind: [org-public-number-and-login-host.md](./org-public-number-and-login-host.md).
8. **Runtime config API (Wave 2+6+7):** `POST/GET /api/internal/v1/runtime-config` (same Bearer as bind). Orchestrator **Sync satellite bindings** also POSTs desired config (internal event URL, PSA emails, SSO shared secret, event token, optional `vendorBridgesEnabled`, `activeModules` / optional `hotelModules`, optional `deploymentTopology` + `edition`). Sync **omits** folklore secrets so they cannot overwrite droplet install env. Satellites persist `_era_runtime_config` + `.data/runtime-config.json` and apply env side-effects so existing `ERA_SSO_SHARED_SECRET` / `PLATFORM_SUPER_ADMIN_EMAILS` readers work — folklore values are stripped and do not stomp `process.env`. **`deploymentTopology` is informational** — satellites must **not** skip the `organizationId` tenant filter based on SHARED/DEDICATED/ONPREM.

   **Pull / reconcile (Waves 6–7):** Orchestrator exposes `GET /v1/internal/satellites/desired-state?satelliteKey=` (Bearer control-plane / satellite-event token family, `X-Organization-Id` required). Payload builder is shared with Sync (`buildRuntimeConfigPayload`); folklore secrets omitted. **Require** an enabled `SatelliteEndpoint` row for that org+key (cluster-wide token must not read arbitrary orgs). Kit `onSatelliteBoot` hydrates local snapshot, then `pullDesiredStateOnce` (default on when `ERA_IN_DOCKER=1`; override `ERA_DESIRED_STATE_PULL=0|1`). Pull failure or orch down **does not** fail boot. Wave 7: jittered poll `ERA_DESIRED_STATE_POLL_MS` (default 60s, `0` disables); hash skip (memory + persisted `desiredStateHash` / `pulledAt` on `_era_runtime_config`); 5xx backoff cap 15 min; **401 stops** the loop (and does not start it after a boot 401). Process-wide fields only — per-org Elektraweb / clinic cutover / fiscal / login hosts remain Sync-push (not SHARED per-org upsert on pull). **Not** PlacementJob / `era-placement-agent.mjs` (topology hop axis).
9. **Wave 3 (request-time helper):** product call sites (SSO exchange, billing-snapshot, receipts, settlement, bank BFF/engine headers, kit MDM/catalog/workforce clients) **must** call `satelliteOrganizationId()` / `resolveSatelliteOrganizationId()` from `@era/satellite-kit` **inside the handler/function** — never capture org id into a module-level `const` from `process.env` for request paths. Dropped legacy `ERA_HOTEL_ORGANIZATION_ID` / `ERA_CLINIC_ORGANIZATION_ID` aliases from kit integration clients. Seeds/offline bootstrap may still read env (documented); bank/dbo/bank-core Prisma boot may `setRuntimeOrganizationId` from env once at process start.

## Resolution order (`satelliteOrganizationId()`)

1. Runtime bind (memory, set by POST bind or boot `setRuntimeOrganizationId`)
2. File cache (`ERA_ORG_BIND_FILE` or `.data/organization-bind.json`)
3. Env emergency override: `ERA_SATELLITE_ORGANIZATION_ID` → `ERA_BANK_ORGANIZATION_ID` → `ORGANIZATION_ID`
4. Fallback `demo-org` (non-production smoke only)

DB row is loaded on bind GET/POST and when handlers hydrate; prefer calling kit helper rather than caching org id in module-level `const`.

**Boot hydrate (required):** each satellite must call `onSatelliteBoot({ prisma })` from Next.js `instrumentation.ts` (or Nest bootstrap) so a container recreate without `.data/` volume still restores `_era_organization_bind` into runtime before the first request. Production `satelliteOrganizationId()` refuses silent `demo-org` fallback (`SatelliteOrganizationUnboundError`). In Docker, boot then **pulls** CP desired-state once and may start the reconcile loop (see §8); host `npm run dev` leaves pull off unless `ERA_DESIRED_STATE_PULL=1`.

## Consequences

- Happy path after Connect: set satellite endpoint URLs → **Sync satellite bindings** on org hub — no manual `.env` UUID copy.
- Images older than this ADR need rebuild/redeploy before Sync works.
- Import-time `process.env.ERA_*_ORGANIZATION_ID` in request handlers is forbidden after Wave 3; use `satelliteOrganizationId()` so Sync bind is visible without process restart.
- AC-*-TENANT stay 🟡 (schema+filter ≠ live SHARED pool). CP-BIND / CP-TENANT remain API coverage, not sell. Prisma tenant extension is fail-closed: unbound / production `demo-org` throws; creates stamp context org.
- **SHARED pool (target):** process bind is **not** the org for ops HTTP. Each request must set kit `runWithSatelliteTenant` / `enterSatelliteTenant` from session / bridge JWT / S2S body **before** `requireSatelliteModule` (entitlement = that org’s CP snapshot, not Sync bind). Sync runtime-config for vendor bridges must upsert **per `organizationId`**, not one process-wide row. Canon: [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md). Bind above remains correct for DEDICATED/ONPREM and bootstrap.
