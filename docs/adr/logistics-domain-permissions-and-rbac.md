# ADR: Logistics domain permissions and configurable RBAC (Variant A)

**Status:** Accepted — Variant A catalog v1  
**Date:** 2026-10-04  
**Coverage:** LOG-RBAC-01 · AC-LOG-RBAC 🟡 (out of BE rollup until field UAT)

**Related:**

- [retail-domain-permissions-and-rbac.md](./retail-domain-permissions-and-rbac.md) — same mechanics, first satellite of this wave
- [fnb-domain-permissions-and-rbac.md](./fnb-domain-permissions-and-rbac.md) — reference shape
- [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md) §2 — one session read per handler

---

## Context

`era-logistics` had no role-name door: every staff page and API was session-only. The PRD names `DISPATCHER` and `DRIVER` but nothing enforced the split; `GET /api/driver/trips` is a labeled list of all open trips, not a driver-scoped session. `Role.permissionsJson` existed and stayed `[]`. There was no `/api/auth/me`, no `/admin/access` and no seed for role rows. `GET /api/tracking/[token]` reads a trip by its tracking token after a staff session (no extra grant).

## Decision

### D1 — Variant A on logistics (local matrix)

1. System packages per org via `ensureSystemRoles` (`src/lib/auth/ensure-system-logistics-roles.ts`): `DISPATCHER`, `DRIVER` plus the control-plane trio `BUSINESS_OWNER`, `PLATFORM_MEMBER`, `SATELLITE_OPERATOR`. Login, SSO exchange, refresh-permissions and `GET /api/admin/roles` run it.
2. `Role.isSystem`, `Role.cloneFromCode`, `Role.permissionCatalogVersion` (migration `20261004125000_logistics_role_rbac_fields`, table `"Role"`). Audit rows go to `satellite_audit_logs`.
3. SatAdmin screen `/admin/access`: role × permission matrix, clone, Reset to defaults, delete an unused custom role, assign a role to a user (`GET/PATCH /api/admin/users`; unknown role code → 400).
4. `admin:access_manage` default: `DISPATCHER` only (the PRD has no manager code). It does **not** bypass.
5. Bypass: platform super-admin and OrgOwner (`isOwner` / `BUSINESS_OWNER`) only. Only a bypass actor can move a user into or out of `BUSINESS_OWNER`.
6. JWT carries `permissions[]`; `POST /api/auth/session/refresh-permissions` re-signs after Save. A missing claim is an empty list. New `GET /api/auth/me` returns DB grants for the shell.
7. Pages: middleware `authorizePage` maps the pathname to any-of grants (`src/lib/auth/page-route-permissions.ts`). Unlisted page → `/login?error=forbidden`.
8. APIs: `getSatelliteSession()` builds grants from the role row and checks the path the middleware stamped (`x-era-pathname`) against `src/lib/auth/api-route-permissions.ts`. Unlisted staff API → 403. Session-only: `/api/auth/me`, `/api/auth/session/refresh-permissions`, `/api/platform/billing-snapshot`, `/api/tracking/*`. A missing `x-era-pathname` denies (a non-API path still passes, for server components). `POST /api/auth/logout` clears the staff cookie; the edge still requires that cookie, and the route is not a grant.
9. Tracking: `GET /api/tracking/[token]` reads the staff session (session-only, no extra grant) and then selects the trip by the path token. The middleware still asks for a staff token, so this is not a public customer surface. Making tracking reachable by end customers is a separate decision.

### D2 — Catalog keys (v1)

SSOT: `era-logistics/src/lib/auth/permissions.ts`. Prefixes `screen:` / `api:` / `admin:` only. No `scope:*`.

| Package | Grants |
|---------|--------|
| `DRIVER` | `screen:home`, `screen:trips`, `screen:trips.detail`, `screen:fleet`, `screen:customs`, `screen:reports.fuel`; `api:trips` (list, edit, shipment rate, SLA ETA), `api:trips.waybill`, `api:trips.pod`, `api:trips.complete`, `api:trips.points`, `api:driver.trips`, `api:fleet.alerts`, `api:hub.scan`, `api:cod.settle`, `api:reports.fuel` (also trip fuel report), `api:customs.preview` (HS and FX preview) |
| `DISPATCHER` | everything, including `screen:admin.settings`, `screen:admin.access`, `admin:access_manage` |
| `PLATFORM_MEMBER`, `SATELLITE_OPERATOR` | driver package |
| `BUSINESS_OWNER` | everything (bypass) |

`api:driver.trips` is on both ops packages: the route lists all open trips and has no driver binding yet. A driver-scoped list is a later domain change, not a grant change.

### D3 — Cutover

- A row with `permissionCatalogVersion = 0` and an empty or invalid list predates the matrix. It takes a template once: the system code's own, an alias (`ADMIN`, `MANAGER`, `OWNER`, `DIRECTOR`, `LOGISTICS_MANAGER` → `DISPATCHER`; `COURIER` → `DRIVER`), or for any other legacy code the `DRIVER` package with `cloneFromCode` set.
- From version 1 on, a valid array, including `[]`, is authoritative. A customized row does not gain new catalog keys; Reset or a manual grant adds them.

**Deliberate delta from pre-matrix access:** `/admin/settings` (local-only screen) was open to any session; it now needs `screen:admin.settings`, which only the dispatcher and the owner hold by default.

### D4 — Out of scope

Orchestrator matrix sync (Variant B), fleet desired-state (Variant C), per-user overrides, driver-scoped trip list, public customer tracking, read-only `SATELLITE_OPERATOR` package, SHOW / SHIPPED / Pilot flip, Scaffold ✅ on AC-LOG-RBAC.

---

## Consequences

- Strip `api:driver.trips` from the driver package → `GET /api/driver/trips` returns 403 for drivers.
- Strip `api:trips.complete` from a package → trip complete returns 403 while trip edit still works.
- Driver opening `/admin/settings` → redirect `/login?error=forbidden`.
- New staff route without a catalog row → 403 until `api-route-permissions.ts` lists it (inventory spec fails first).

## Acceptance

1. `__tests__/logistics-rbac.spec.ts`, `logistics-rbac-doors.spec.ts`, `logistics-rbac-inventory.spec.ts`, `logistics-rbac-role-name-grep.spec.ts` green.
2. `/admin/access` edits persist; refresh-permissions updates the JWT and the nav.
3. UAT-SMOKE LOG-RBAC-01 steps listed and unchecked.
4. COVERAGE `LOG-RBAC-01` = API (UI class SCREEN); AC-LOG-RBAC 🟡 out of BE rollup.
5. `npm run check:acceptance` PASS.
