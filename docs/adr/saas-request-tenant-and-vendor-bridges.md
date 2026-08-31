# ADR: SaaS request tenant + vendor dual-run bridges

**Status:** Accepted — **Waves 1–12 + isolation engineering landed** (request tenant; cron orch pool SoR; hotel/clinic request-org stamps; SHARED Sync skip-bind; Placement artifact + host agent apply path). **Still open (do not claim ready):** HOT-06 field SHIPPED, field TENANT Scaffold ✅, Placement field UAT / AC-CP-TOPO Scaffold ✅, edition `ga` / sell SHARED pool.  
**Date:** 2026-08-27 (honesty closeout Wave 12: 2026-08-28)  
**Coverage:** HOT-06 stays **HEADLESS**. AC-*-TENANT 🟡, AC-CP-TOPO 🟡, edition `ga` unchanged. See [SaaS-Honesty-Closeout.md](../acceptance/SaaS-Honesty-Closeout.md).  
**Related:** [deployment-topology.md](./deployment-topology.md) · [satellite-organization-bind.md](./satellite-organization-bind.md) · [hotel-elektraweb-live-bridge.md](./hotel-elektraweb-live-bridge.md) · [hotel-elektraweb-reverse-folio-post.md](./hotel-elektraweb-reverse-folio-post.md)

**Reading path (short):** [docs/SAAS_SHARED_RUNTIME.md](../SAAS_SHARED_RUNTIME.md)

## Context

ERA schema work put `organizationId` on satellite tenant rows and a fail-closed Prisma tenant filter (CP-TENANT-01). Control-plane vocabulary is SHARED / DEDICATED / ONPREM. Product intent: **ERA cloud SaaS** — many hotels in **one** hotel-pms process; Super-Admin turns capabilities on **per org**.

**Waves 1–11 landed the runtime prep** (request tenant + per-org vendor policy + lab evidence). The table below is the **pre-wave gap** that motivated the ADR; do not read it as current code state — see [SAAS_SHARED_RUNTIME.md](../SAAS_SHARED_RUNTIME.md).

That gap was:

| Layer | Today | SaaS target |
|-------|--------|-------------|
| Postgres column `organizationId` | Present on tenant roots | Same |
| Process bind `satelliteOrganizationId()` | **One** UUID for the whole Node process (Sync bind / env) | DEDICATED/ONPREM only; SHARED must **not** use this for ops requests |
| Prisma filter | Kit can use request ALS `runWithSatelliteTenant`; **hotel-pms never sets it** → falls back to process bind | Each request: filter = org of the logged-in staff / bridge JWT / S2S body |
| Elektraweb bridge | `ELEKTRAWEB_HOTEL_ID`, walk-in ids, write kill, clinic `CLINIC_ELEKTRAWEB_DUAL_RUN` in **env**; JWT org compared to **process** bind | Super-Admin card **per hotel org** (and dual-run **per clinic org**); JWT org = that card |
| Widget login | `login` + password → `getUserByLogin` **without** org (`findFirst`) | Login unique per org → must send **which hotel** |

Nafta dual-run (Excel + MV3 extension + extra-ticket outbox) was built as an **appliance** (one property per process). The owner’s SaaS picture is the opposite: **120 hotels in one pool**, each possibly pulling from **their** old PMS for a cutover window, all configured from Super-Admin — not from droplet `.env`.

Column `organizationId` ≠ “the process is multi-tenant at runtime.” False-green to sell SHARED pool from schema alone ([deployment-topology.md](./deployment-topology.md)).

## Decision

### 1. Super-Admin is SoR for tenant-heavy settings

Anything that **differs per customer org** and is architecturally heavy (vendor dual-run, property ids in a foreign PMS, clinic extra routing during cutover) is configured on **that org** in the orchestrator, then **Sync**’d to the satellite **keyed by `organizationId`**.

Operators on the property still use the **browser extension** (desk FO vs sanatorium, Capture, Write). They do not paste Elektraweb `HOTELID` into compose.

### 2. Request tenant (SHARED law)

For every hotel (then clinic) **HTTP request** in a SHARED pool:

1. Resolve `organizationId` from **this request**: session user, SSO payload, bridge JWT, or clinic→hotel POST body — never from process bind.
2. Wrap Prisma work in `runWithSatelliteTenant({ organizationId })` (kit ALS already exists). **Pass that org into `requireSatelliteModule({ organizationId })`** — do not rely on `enterWith` surviving the next `await` in Next.js. The gate then `assertEntitled` via CP `GET /internal/v1/subscription/snapshot` (Bearer `SATELLITE_EVENT_SERVICE_TOKEN` or control-plane token), then last Sync runtime-config cache. Process bind / Sync `activeModules` in memory is DEDICATED-only.
3. Look up vendor-bridge policy with **that** id.

Process bind (`POST /api/internal/v1/organization/bind`, `ERA_SATELLITE_ORGANIZATION_ID`) remains valid for **DEDICATED / ONPREM** (one org ≈ instance) and as **bootstrap** before the first request. It must **not** stamp ingest/outbox/folio for 120 tenants.

Cron: `runCronForEachTenant` (already in topology ADR).

### 3. Staff login is per org

`User.login` is unique as `@@unique([organizationId, login])`. Widget and local `/login` in SHARED **must** take `organizationId` (field, query, or hostname map). `findFirst({ login })` across the pool is forbidden.

### 4. Vendor dual-run bridge (Elektraweb first; pattern for others)

**Orchestrator (write):** policy on the **hotel** org, e.g. inbound/write flags, `elektrawebHotelId`, SPA dep/currency, walk-in house `RESID` / `RESNAMEID`. On the **clinic** org: `elektrawebDualRun` + which hotel org receives outbox. `hotelOrganizationId` **may equal** the clinic org UUID when that MMC also hosts hotel PMS (Nafta one-org). A clinic-only org must still point at a different existing hotel org.

**Hotel DB (read on request):** same fields, upserted by Sync for **that** `organizationId` only. A single process-wide `_era_runtime_config` row must **not** be overwritten by Nafta Sync (that would wipe 119 others).

**JWT:** claims `organizationId` + `elektrawebHotelId` from **policy of the logged-in user’s org**. Verify against that policy, **not** against process bind / env. Drop process-wide `ELEKTRAWEB_BRIDGE_TOKEN` (one Bearer would be root on every folio in the pool).

**Ingest / outbox:** `organizationId` from JWT (or POS body). `HOTELID` in Elektraweb payload must match **that org’s** policy. Drain GET returns only that org’s PENDING rows. Write drain allowed only if **that** org has `writeEnabled`.

**Clinic:** dual-run flag from **clinic org** policy, not `CLINIC_ELEKTRAWEB_DUAL_RUN`. Outbox POST includes hotel `organizationId`. `HOTEL_PMS_URL` is **one** URL for the whole hotel pool (same SaaS host for all 120); it is not a per-property Elektraweb id. Prefer resolving it from `SatelliteEndpoint` of the linked hotel org; env is an install fallback.

Hour X is **per org**: Super-Admin turns write + clinic dual-run off for Nafta only.

Non-Elektraweb cutovers (other PMS) reuse this pattern: new policy fields, same request tenant + Super-Admin card. Do not add a second env family.

### 5. What may stay off the org card (install / pool crypto)

These are **not** Nafta Elektraweb ids. They belong to the **hotel (or clinic) process**, not to one of 120 org forms:

| Setting | Why not on the Nafta org form |
|---------|-------------------------------|
| `DATABASE_URL`, Redis, listen port | Machine |
| `AUTH_JWT_SECRET` | Signs **all** sessions in this hotel process. Changing it “for Nafta” would invalidate 120 hotels. |
| `POS_BRIDGE_SECRET` | Proves clinic-pool → hotel-pool S2S. Which hotel is in the JSON `organizationId`. May later Sync as **pool** desired state, still not per-property EW ids. |
| Optional pool flag “vendor bridges allowed on this install” | Emergency kill for **everyone**; Super-Admin platform flag is fine. Does not enable Nafta by itself. |

**Must leave env (and `config.ts`) for property-shaped values:** `ELEKTRAWEB_HOTEL_ID`, `ELEKTRAWEB_BRIDGE_WRITE_ENABLED`, `ELEKTRAWEB_WALKIN_*`, `ELEKTRAWEB_SPA_DEPID` / `CURRENCY_ID` as process defaults, `CLINIC_ELEKTRAWEB_DUAL_RUN`. Nafta numbers (31606, Tibbi `RESNAMEID`) live only on **Nafta’s** policy row.

### 6. Implementation waves (do not one-PR “full SaaS”)

| Wave | Scope | Status |
|------|--------|--------|
| **1** | Hotel request tenant + Super-Admin Elektraweb/clinic cutover policy + Sync row upsert + strip property env | **Landed** |
| **2** | Clinic request tenant (login/SSO/JWT/middleware/`enterSatelliteTenant` + lifecycle S2S + ops stamps via ALS) | **Landed** |
| **3** | Remaining industry Next satellites (F&B, retail, CRM, wholesale, logistics, construction, auto) + finance Nest ALS audit | **Landed** |
| **4** | Multi-org cron: leftovers → `runCronForEachTenant`; hotel/clinic/auto `byOrganization` JSON; SHARED list = `ERA_CRON_ORGANIZATION_IDS` | **Landed** |
| **5** | Lab two-org isolation (hotel + clinic CI suites + UAT lab/field split + signoff lab pass) | **Landed** |
| **6** | HOT-06 lab SHOW path (SuperAdmin policy + clinic Issue-ticket; extension SPA Insert still HEADLESS) | **Landed** — not SHIPPED / not `ga` |
| **7** | Placement lab hop SHARED→DEDICATED advance chain + Platform UAT; slice still metadata stub | **Landed** — AC-CP-TOPO 🟡; no live dump/sell |
| **8** | EW ingest stamps: `bridgeRequestOrganizationId` (ALS first) in folio/reservation/resnameid | **Landed** — HOT-06 still not SHIPPED |
| **9** | Live SHARED pool smoke scripts (hotel + clinic, `ERA_WAVE9_POOL_SMOKE`) + field runbooks / signoff middle tier | **Landed** — field evidence open; TENANT 🟡; HOT-06 not SHIPPED |
| **10** | Cron org DB-discover: `listOrganizationIds` + User DISTINCT; env `ERA_CRON_ORGANIZATION_IDS` still wins | **Landed** — TENANT still 🟡; no orch SoR list |
| **11** | Hotel curated JSON org-slice dump + orch `sliceMeta` counts; lab import validate | **Landed** — AC-CP-TOPO 🟡; host apply open; not SHIPPED / not `ga` |
| **12** | Honesty closeout: status drift fix + acceptance SaaS false-green bans | **Landed** — no Scaffold/SHIPPED/`ga` flips |

Nafta on **ERA cloud** as the first hotel org in a SHARED-ready process is allowed **after wave 1**. Until wave 1, enabling the current env bridge on a process that already hosts other hotel orgs is **forbidden** (wrong folio / wrong `HOTELID`).

### 7. Honesty / acceptance

- HOT-06 stays **HEADLESS**. Waves 1–3 request tenant landed for hotel, clinic, and remaining industry Next satellites; finance uses Nest membership ALS (not kit).
- **Wave 4:** industry cron hooks use `runCronForEachTenant` + `byOrganization` responses. SHARED cron org list was env-only until Wave 10.
- **Wave 5:** hotel + clinic lab two-org isolation CI suites green; field UAT still pending — AC-*-TENANT stay 🟡 (lab ≠ Scaffold ✅).
- **Wave 6:** HOT-06 lab signoff — SuperAdmin EW policy + clinic Issue-ticket **SHOW**; extension write HEADLESS; not SHIPPED.
- **Wave 7:** PlacementJob lab hop SHARED→DEDICATED full advance + REJECTED SHARED↔ONPREM; export was metadata stub until Wave 11.
- **Wave 8:** Elektraweb ingest create/update stamps use `bridgeRequestOrganizationId()` (ALS before process bind) — SHARED pool no longer stamps wrong org via `satelliteOrganizationId()` on folio/reservation/resnameid.
- **Wave 9:** opt-in live pool smoke (`ERA_WAVE9_POOL_SMOKE=1`) + HOT-06 field runbook; field signoff rows stay pending — live smoke ≠ Scaffold ✅ / SHIPPED.
- **Wave 10:** cron `listOrganizationIds` (DISTINCT staff `User`) when env unset; env override wins; org without User rows skipped — not TENANT Scaffold ✅.
- **Wave 11:** hotel curated JSON slice (role/user/guest) + orch `sliceMeta`; host compose/restore still open — AC-CP-TOPO 🟡.
- **Wave 12:** honesty closeout — [SaaS-Honesty-Closeout.md](../acceptance/SaaS-Honesty-Closeout.md); `check:acceptance` SaaS bans; no claim flips.
- AC-*-TENANT / AC-CP-TOPO stay 🟡 (no live SHARED pool field UAT / Scaffold ✅).
- Do not mark edition `ga` or “SaaS pool ready” from this ADR alone.
- **Finance Wave 3 audit:** `TenantContextInterceptor` fills `tenantContextStorage` from JWT `organizationId`; no kit `satelliteOrganizationId()` ops stamps in finance production code.
## Consequences

**Positive:** 120 hotels can each have a time-boxed vendor bridge; Super-Admin enables Nafta without redeploy; hour X is one org card.

**Negative:** wave 1 is real hotel login + Prisma ALS + Sync shape work, not a form-only change. Widget “add hotel id” without request tenant and `getUserByLogin(org)` is decoration.

**Rejected:** keeping Elektraweb ids in env “until the pool is busy”; process bind as the SaaS tenant; shared bridge Bearer for the pool.
