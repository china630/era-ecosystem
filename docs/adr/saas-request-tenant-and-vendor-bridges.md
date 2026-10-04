# ADR: SaaS request tenant + vendor dual-run bridges

**Status:** Accepted — **Waves 1–12 + isolation engineering landed** (request tenant; cron orch pool SoR; hotel/clinic request-org stamps; SHARED Sync skip-bind; Placement artifact + host agent apply path). **Still open (do not claim ready):** HOT-06 field SHIPPED, field TENANT Scaffold ✅, Placement field UAT / AC-CP-TOPO Scaffold ✅, edition `ga` / sell SHARED pool.  
**Date:** 2026-08-27 (honesty closeout Wave 12: 2026-08-28)  
**Coverage:** HOT-06 stays **HEADLESS**. AC-*-TENANT 🟡, AC-CP-TOPO 🟡, edition `ga` unchanged. See [SaaS-Honesty-Closeout.md](../acceptance/SaaS-Honesty-Closeout.md).  
**Related:** [deployment-topology.md](./deployment-topology.md) · [satellite-organization-bind.md](./satellite-organization-bind.md) · [hotel-elektraweb-live-bridge.md](./hotel-elektraweb-live-bridge.md) · [hotel-elektraweb-reverse-folio-post.md](./hotel-elektraweb-reverse-folio-post.md) · [org-public-number-and-login-host.md](./org-public-number-and-login-host.md) (ERA ID / login Host — accepted, not implemented) · [era-fiscal-kkm-kit.md](./era-fiscal-kkm-kit.md) (KKM/bank POS credentials per org/device, not env)

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

Column `organizationId` ≠ “the process is multi-tenant at runtime.” False-green to sell SHARED pool from schema alone ([deployment-topology.md](./deployment-topology.md)). The Postgres name is `"organizationId"` (hotel style, no `organization_id` map). A parent row with the column is not enough: line and child tables carry the same column, copied from the parent. Clinic: migration `20261001130000_clinic_child_organization_id`. Retail already had the column on every table, including `ReceiptLine`; migration `20261001160000_retail_organization_id_rename` only renames `organization_id` to `"organizationId"`. Global catalogs (`IcdCode`, diagnostic and physio templates) stay unscoped.

## Decision

### 1. Super-Admin is SoR for tenant-heavy settings

Anything that **differs per customer org** and is architecturally heavy (vendor dual-run, property ids in a foreign PMS, clinic extra routing during cutover) is configured on **that org** in the orchestrator, then **Sync**’d to the satellite **keyed by `organizationId`**.

Operators on the property still use the **browser extension** (desk FO vs sanatorium, Capture, Write). They do not paste Elektraweb `HOTELID` into compose.

### 2. Request tenant (SHARED law)

For every hotel (then clinic) **HTTP request** in a SHARED pool:

1. Resolve `organizationId` from **this request**: session user, SSO payload, bridge JWT, or clinic→hotel POST body — never from process bind.
2. Wrap Prisma work in `runWithSatelliteTenant({ organizationId })` (kit ALS already exists). **Pass that org into `requireSatelliteModule({ organizationId })`** — do not rely on `enterWith` surviving the next `await` in Next.js. When ALS is empty, `resolveSatelliteTenantFilter` reads the org `enterSatelliteTenant` stored on the Next request work store (the staff session enters it), so Prisma and `requestOrganizationId()` still see the org after the module gate. The gate then `assertEntitled` via CP `GET /internal/v1/subscription/snapshot` (Bearer `SATELLITE_EVENT_SERVICE_TOKEN` or control-plane token), then last Sync runtime-config cache. Process bind / Sync `activeModules` in memory is DEDICATED-only.
3. Look up vendor-bridge policy with **that** id.

Process bind (`POST /api/internal/v1/organization/bind`, `ERA_SATELLITE_ORGANIZATION_ID`) remains valid for **DEDICATED / ONPREM** (one org ≈ instance) and as **bootstrap** before the first request. It must **not** stamp ingest/outbox/folio for 120 tenants.

Cron: `runCronForEachTenant` (already in topology ADR).

**Staff session standard (final).** One shape in every industry satellite (hotel, clinic, F&B, bank, retail, CRM, logistics, wholesale, construction, auto):

- **Organization comes from the signed token only.** Kit `readSatelliteStaffSession` verifies the cookie (or Bearer), takes `organizationId` from the token claim, enters that tenant, then loads the staff row through the app's `loadUser` inside the tenant filter. A token without an org claim, a missing row, an inactive row (`active: false`), or a row whose org differs from the token org → no session. The request header `x-era-organization-id`, the user row as an org source, and the process bind are never read. All signers (local login, SSO exchange, F&B PIN, refresh-permissions) already put the org in the token; a legacy cookie without one logs in again (12h expiry).
- **One app wrapper, same name everywhere.** `getSatelliteSession()` in each app = kit session → module gate for the session org (`require*Satellite(org)`, hotel `assertHotelApiEntitled(path, org)`, clinic `assertClinicApiEntitled(path, org)`) → permissions from the loaded role row (owner and platform super-admin get all; the six satellites without a permission catalog keep role checks only). No session → `null` (401). Module off → `IndustryModuleInactiveError` (403 through `handleRouteError`). Bank: an inactive `OpsUser` has no session (no longer an empty-permission session). F&B: a PIN token (`pin: true`, `sub` = `StaffRoster.id`) checks the roster row's `active`; a password token checks `User.status`.
- **One read per handler, inside `try`.** Each exported route handler calls `getSatelliteSession()` once inside `try` and passes `session` (and `session.organizationId`) on: hotel `requireHotelModule(key, session.organizationId)`, clinic `requireClinicModule(key, session.organizationId)`, services that need the org take it as an argument (for example hotel `fetchClinicCapacitySummary(org, date)`, `getExecutiveDashboard(org, date)`). Helpers that read the session are the single read for their route and return it or deny: clinic `assertClinicAdminRoute` / `assertOpsApiPermission` / `assertVisitExamPrintAccess`, hotel `assertPosBridgeOrPermission`, `assertHotelImportAccess`, F&B `assertFnbImportAccess`, retail `assertRetailImportAccess`. Permission checks and data scope use `session.permissions` (no second DB read; clinic `assertClinicPermission` and `resolveClinicDataScope`, bank BFF proxy and admin routes). The `assert*Entitled` helpers are deleted in all apps; staff routes that had only that call now read the session and return 401 without it. F&B logout reads only the signed token so it works for an inactive module or user.
- **Module gates take the org only as an argument.** App gates (`require*Satellite`, `requireHotelModule`, `requireClinicModule`, bank `requireBankingModule`, bank-dbo `requireDboSatellite`) have a required `organizationId`; hotel and clinic gates no longer read the header. Kit `requireSatelliteModule` uses the explicit org, else ALS; with neither it throws `IndustryModuleInactiveError`. The process bind is not a fallback there; cron and workers get their orgs from `runCronForEachTenant` / `listCronOrganizationIds` (DEDICATED / ONPREM: the process org is legal outside a request). Kit `runCronIfEntitled` is removed; `checkCronEntitlement` requires the org.
- **Middleware sets the org header from the token only.** Kit `createSatelliteStaffMiddleware` drops client copies of `x-user-id`, `x-user-role`, `x-era-organization-id` on every path (staff API, staff pages, public API, public pages) and stamps them from the verified token on staff paths. `/login` gets the host-bound org after the strip. `serviceApiPrefixes` (default `/api/events/dispatch`, `/api/internal`; clinic adds `/api/capacity/summary`) keep the caller's org header because the handler checks a service secret first. Passthrough prefixes (multipart import) are rejected when a sent identity header differs from the token. `authorizeApi(ctx)` runs after token verification on staff API paths; hotel's placement freeze (423) uses it with the token org. Hotel POS-bridge paths stay a trusted S2S branch; the agency branch strips the session headers. Handlers never treat those headers as the session.
- **Guard.** `npm run check:satellite-session` (`scripts/check-satellite-session-standard.mjs`, part of `run:quality-gates`) fails on `assert<App>Entitled`, more than one session read per route handler or a read outside `try`, `x-era-organization-id` in module gates or the kit session, and one-argument `requireHotelModule` / `requireClinicModule`.

Kept as they were: staff login (bank and every other industry satellite, including hotel and the Elektraweb bridge login) takes the org from `orgNo` or the host and returns 400 when neither is present. Bank DBO customers are not staff and never type an ERA ID: the DBO channel takes the org from the host (or a lab `orgNo`), and a DEDICATED/ONPREM DBO instance, which serves one bank, falls back to its deployment org; SHARED DBO without a host binding is refused; DBO checks the module after the customer session resolves, for that session org. `POST /api/events/dispatch` stamps `organizationId` from the request context (`x-era-organization-id`, ALS, or the Next request store) and returns 400 when that context is empty; the JSON body and the process bind are not the source. F&B PIN tokens carry the org; a paired tablet (`era_fnb_terminal`) sends staff pages without a session to `/pin` unless a password logout left `era_fnb_login_choice=password`, which sends them to `/login`. Hotel signs staff tokens with kit `signSatelliteSession` (12h). Its middleware keeps the POS bridge secret and the agency portal (`/agency`, `/api/agency/*`, cookie `era_agency_session`, read by `getAgencySession`; agency routes use `requireAgencyPortalSession`, which enters the agency org and checks `hotel_agency_portal`) in front of the factory, so an agency cookie never opens staff routes and a staff cookie never opens the agency portal. Staff `/api/agencies/*` is the staff directory, not the agency portal. Bank keeps page permissions in middleware and `?from=` on the login redirect. The session email is the token email, so an old cookie without email loses the platform super-admin bypass until the next login. SSO exchange routes stay public and take the org from the signed ticket before the cookie exists; on every topology the ticket org is the session org, and the exchange does not compare it with the process bind (the orchestrator checks membership when it mints the ticket; the module gate checks entitlement for that org on each request). Hotel agency SSO follows the same rule.

Routes outside the staff standard by design: `/api/locale`, cron (`/api/cron/*`, hotel `admin/reports/email-cron`, `PUT /api/service/recurring`) behind their cron secret, S2S and webhooks (hotel `integration/gl-status`, `integrations/minibar-sensor`, F&B `webhooks/pms/reservation-lifecycle`, retail `integration/*`), retired hotel `admin/contract-pricing` (410), hotel `service/guest-request` (guest token), logistics `tracking/[token]`.

**Data layer.** `resolveSatelliteTenantFilter` reads ALS, then the org `enterSatelliteTenant` stored on the Next request. The dead synchronous `headers()` read is removed. Inside a Next request with no entered org the filter throws `SatelliteOrganizationUnboundError`; the process bind is only outside a request (cron, workers). Staff handlers that already hold the session pass `session.organizationId` (fiscal device lists, hotel booking sources and cash shifts, clinic/hotel/F&B role and user admin). Services may still call `requestOrganizationId()`: after `getSatelliteSession()` that is the entered org, and without an entered org it throws instead of stamping the process bind.

### 3. Staff login is per org

`User.login` is unique as `@@unique([organizationId, login])`. Widget and local `/login` in SHARED **must** name the org via public `orgNo` (field / `?org=` / ERA subdomain / paid custom Host) resolving to UUID — [org-public-number-and-login-host.md](./org-public-number-and-login-host.md). `findFirst({ login })` across the pool is forbidden.

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
| Optional pool flag `vendorBridgesEnabled` (Sync) / `ELEKTRAWEB_BRIDGE_ENABLED` (install bootstrap) | Emergency kill for **everyone**; Super-Admin platform flag / runtime-config is fine. Does not enable Nafta by itself. |

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
| **10** | Cron org DB-discover: `listOrganizationIds` + User DISTINCT; env `ERA_CRON_ORGANIZATION_IDS` still wins | **Superseded** — orch registry only (kit `listCronOrganizationIds`); see §7 |
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
- **Tenant filter skip removal (supersedes the Wave 4 / Wave 10 org-list chain):** kit `listCronOrganizationIds` is the single cron org list. SHARED = orch pool registry only (backoff; empty / drop / auth / missing config → 503, no work). DEDICATED / ONPREM = process org. `ERA_CRON_ORGANIZATION_IDS`, satellite `listOrganizationIds` (User DISTINCT) and the env switch `ERA_SKIP_TENANT_FILTER` are removed. Seeds / loaders / imports / wipes bind the target org and keep the filter on. Clinic extra-ticket print carries `organizationId` in the link. See [SAAS_SHARED_RUNTIME.md](../SAAS_SHARED_RUNTIME.md#multi-org-cron-waves-4--10--isolation-eng).
- **No unfiltered mode (follow-up pass):** the org list always comes from a directory (orch pool registry for satellites, the finance `Organization` table); each org is then processed with the filter on. Kit ALS `skipTenantFilter` is removed; hotel Channex / IBE binding lookups and the F&B public menu (`publicSlug`) iterate registry orgs inside `runWithSatelliteTenant`, and F&B `prismaBare` is gone. Finance: no ALS context → `ForbiddenException`; `skipTenantFilter: true` remains only for super-admin `/api/admin/*` and `audit-archive.worker.ts`; workers / crons / public and S2S routes enter `runWithTenantContextAsync` per org (details in `era-finance-core/TZ.md` §16). The unused recovery `bypassTenantFilter` is removed. Orchestrator `billing-monthly.service.ts` dropped its `skipTenantFilter` wrappers: orch Prisma has no tenant extension, so they changed nothing; owner-level billing across orgs stays cross-org by design.

## Consequences

**Positive:** 120 hotels can each have a time-boxed vendor bridge; Super-Admin enables Nafta without redeploy; hour X is one org card.

**Negative:** wave 1 is real hotel login + Prisma ALS + Sync shape work, not a form-only change. Widget “add hotel id” without request tenant and `getUserByLogin(org)` is decoration.

**Rejected:** keeping Elektraweb ids in env “until the pool is busy”; process bind as the SaaS tenant; shared bridge Bearer for the pool.
