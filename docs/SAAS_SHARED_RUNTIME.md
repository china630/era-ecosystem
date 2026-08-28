# SaaS shared runtime — request tenant and vendor bridges

**Canon (decision):** [`adr/saas-request-tenant-and-vendor-bridges.md`](./adr/saas-request-tenant-and-vendor-bridges.md)  
**Topology vocabulary:** [`adr/deployment-topology.md`](./adr/deployment-topology.md)  
**Bind / Sync today:** [`adr/satellite-organization-bind.md`](./adr/satellite-organization-bind.md)  
**Elektraweb dual-run (ops):** [`adr/hotel-elektraweb-live-bridge.md`](./adr/hotel-elektraweb-live-bridge.md) · [`adr/hotel-elektraweb-reverse-folio-post.md`](./adr/hotel-elektraweb-reverse-folio-post.md)

This page is the **product/engineering index**. It does not change sell/show. Live SHARED pool **sell** and HOT-06 **SHIPPED** are still **not** claimed. Isolation engineering (hotel/clinic request-org stamps, SHARED Sync skip-bind, orch pool members, Placement host apply code path) **landed** — field UAT / Scaffold ✅ still open.

## What “full SaaS” means here

ERA **cloud**: one process per satellite type, many orgs. Staff use the same satellite URL; **which org** is on the login / JWT / API body.

## What is already true vs what is not

| Already true (Waves 1–12 + isolation eng) | Not true yet |
|---------------------------|--------------|
| Hotel + clinic + industry Next: login/SSO JWT org, middleware, `enterSatelliteTenant`, ops stamps via `requestOrganizationId()` (hotel stamps migrated off process bind) | Selling SHARED pool `ga` |
| SHARED login requires `organizationId` (fail-closed) | HOT-06 **SHIPPED** / field SPA Insert |
| Super-Admin Elektraweb / clinic cutover policy + Sync row upsert (**SHOW** Wave 6 lab) | Field two-org UAT → AC-*-TENANT Scaffold ✅ |
| Finance: Nest `TenantContextInterceptor` + membership JWT org (not kit ALS) | AC-CP-TOPO Scaffold ✅ (field / lab signoff still open) |
| Kit `findUserByCredential(login, org?)` | |
| Hotel / clinic / auto cron via `runCronForEachTenant` + `byOrganization` JSON | |
| SHARED cron: `ERA_CRON_ORGANIZATION_IDS` → **orch pool members** (`GET /api/v1/internal/satellite-pool/members`) → User DISTINCT → bind | |
| Hotel + clinic **lab** two-org isolation CI | Field SHARED pool isolation UAT |
| HOT-06 lab SHOW; extension write HEADLESS | |
| Placement: hotel curated JSON slice + **artifact on job** + host agent import-slice + apply log | Field migrate UAT; multi-sat slices |
| EW ingest ALS-first; Sync **skips** `applyOrganizationBind` when topology SHARED | |
| Entitlement: request ALS + CP snapshot (hotel/clinic session/header before gate); Sync `activeModules` = cache | Sync bind required after every SHARED restart |
| Live pool smoke scripts (Wave 9) | Field signoff pass / sell pool |

## Finance (Wave 3 audit)

Finance already request-tenants via Nest ALS (`TenantContextInterceptor` → `tenantContextStorage` from `req.user.organizationId`). Wave 3 does **not** port kit `enterSatelliteTenant` into finance. No production `satelliteOrganizationId()` stamps found in finance-core (kit mock only in tests).

## Multi-org cron (Waves 4 + 10 + isolation eng)

`runCronForEachTenant`: entitlement gate → org list → per-org `runWithSatelliteTenant`. Cron JSON returns `byOrganization[]`.

Org list priority: `ERA_CRON_ORGANIZATION_IDS` (override) → **orch** `fetchPoolOrganizationIdsFromOrch` → `listOrganizationIds` (User DISTINCT) → process bind. Orgs with no staff `User` rows are still covered when registered on `SatelliteEndpoint` for this process URL.

## Lab two-org UAT (Wave 5)

Hotel + clinic CI suites prove ALS + `mergeWhere` isolation (Org B cannot see Org A). Signoff lab section: [`reports/two-org-isolation-signoff.md`](../reports/two-org-isolation-signoff.md). Field checklist still pending — **not** TENANT Scaffold ✅.

## HOT-06 lab SHOW path (Wave 6)

Lab CI + signoff: [`reports/hot06-lab-signoff.md`](../reports/hot06-lab-signoff.md). Super-Admin policy + clinic Issue-ticket **SHOW**. Extension SPA Insert remains HEADLESS / field-open. **Not SHIPPED**.

## Placement lab hop (Wave 7) + hotel slice dump (Wave 11)

PlacementJob SHARED→DEDICATED full advance chain + SHARED↔ONPREM REJECTED. Wave 11: hotel curated JSON slice (`role`/`user`/`guest`) via kit + hotel internal export-slice; orch `sliceMeta` stores counts/`hotel curated json slice v1` (not `not implemented full dump`). Signoff: [`reports/placement-lab-hop-signoff.md`](../reports/placement-lab-hop-signoff.md). Host apply / field UAT still open — AC-CP-TOPO **🟡**.

## EW ingest ALS stamps (Wave 8)

Hotel Elektraweb folio/reservation/resnameid creates use `bridgeRequestOrganizationId()` (ALS from JWT after `enterBridgeTenant`, else process bind). Proof: `era-hotel-pms/__tests__/saas-wave8-bridge-als-stamps.spec.ts`. HOT-06 still not SHIPPED.

## Live pool smoke + field runbooks (Wave 9)

Opt-in DB smoke (one process / one DB / two org UUIDs): `era-hotel-pms/scripts/saas-wave9-two-org-pool-smoke.mjs`, `era-clinic/scripts/saas-wave9-two-org-pool-smoke.mjs` — gated by `ERA_WAVE9_POOL_SMOKE=1`. Signoff middle tier: [`reports/two-org-isolation-signoff.md`](../reports/two-org-isolation-signoff.md). HOT-06 field desk steps: [`reports/hot06-field-runbook.md`](../reports/hot06-field-runbook.md). **Does not** flip TENANT Scaffold ✅ or claim HOT-06 SHIPPED.

## Build order

1. ~~Hotel~~ (**Wave 1**).  
2. ~~Clinic~~ (**Wave 2**).  
3. ~~Remaining industry Next satellites + finance audit~~ (**Wave 3**).  
4. ~~Multi-org cron leftovers + response honesty~~ (**Wave 4**).  
5. ~~Lab two-org isolation hotel+clinic~~ (**Wave 5**).  
6. ~~HOT-06 lab SHOW path~~ (**Wave 6**).  
7. ~~Placement lab hop deepen~~ (**Wave 7**).  
8. ~~EW ingest ALS stamps~~ (**Wave 8**).  
9. ~~Live pool smoke + field runbooks~~ (**Wave 9** — field evidence still open).  
10. ~~Cron org DB-discover~~ (**Wave 10**).  
11. ~~Hotel Placement JSON slice dump~~ (**Wave 11** — host apply / TOPO Scaffold still open).  
12. ~~Honesty closeout / no false-green~~ (**Wave 12 landed** — [SaaS-Honesty-Closeout.md](./acceptance/SaaS-Honesty-Closeout.md)).  

## Honesty

Index of claim freeze: [`docs/acceptance/SaaS-Honesty-Closeout.md`](./acceptance/SaaS-Honesty-Closeout.md). `check:acceptance` bans positive «SaaS pool ready» / false HOT-06 SHIPPED / false TENANT·TOPO Scaffold ✅.

## Acceptance

HOT-06 capability row remains HEADLESS for extension write; SuperAdmin/clinic screens SHOW after Wave 6 lab. Tenant ACs and AC-CP-TOPO remain 🟡. Live smoke + cron discover + hotel slice lab available; field/host open. No `ga` / “SaaS pool ready” from this document.
