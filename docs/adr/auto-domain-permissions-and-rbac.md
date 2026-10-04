# ADR: Auto service domain permissions and configurable RBAC (Variant A)

**Status:** Accepted — Variant A catalog v1  
**Date:** 2026-10-04  
**Coverage:** AS-RBAC-01 · AC-AUT-RBAC 🟡 (out of BE rollup until field UAT)

**Related:**

- [retail-domain-permissions-and-rbac.md](./retail-domain-permissions-and-rbac.md) — same mechanics, first satellite of this wave
- [fnb-domain-permissions-and-rbac.md](./fnb-domain-permissions-and-rbac.md) — reference shape
- [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md) §2 — one session read per handler

---

## Context

`era-auto-service` had no role-name door: every staff page and API was session-only. `Role.permissionsJson` existed and stayed `[]`. There was no `/api/auth/me`, no `/admin/access` and no seed for role rows. `POST /api/cron/service-due` runs on `PLATFORM_CRON_SECRET` through `runCronForEachTenant` and reads no staff session.

## Decision

### D1 — Variant A on auto service (local matrix)

1. System packages per org via `ensureSystemRoles` (`src/lib/auth/ensure-system-auto-roles.ts`): `SERVICE_ADVISOR`, `TECHNICIAN`, `STO_MANAGER` plus the control-plane trio `BUSINESS_OWNER`, `PLATFORM_MEMBER`, `SATELLITE_OPERATOR`. Login, SSO exchange, refresh-permissions and `GET /api/admin/roles` run it.
2. `Role.isSystem`, `Role.cloneFromCode`, `Role.permissionCatalogVersion` (migration `20261004123000_auto_role_rbac_fields`, table `"Role"`). Audit rows go to `satellite_audit_logs`.
3. SatAdmin screen `/admin/access`: role × permission matrix, clone, Reset to defaults, delete an unused custom role, assign a role to a user (`GET/PATCH /api/admin/users`; unknown role code → 400).
4. `admin:access_manage` default: `STO_MANAGER` only. It does **not** bypass.
5. Bypass: platform super-admin and OrgOwner (`isOwner` / `BUSINESS_OWNER`) only. Only a bypass actor can move a user into or out of `BUSINESS_OWNER`.
6. JWT carries `permissions[]`; `POST /api/auth/session/refresh-permissions` re-signs after Save. A missing claim is an empty list. New `GET /api/auth/me` returns DB grants for the shell.
7. Pages: middleware `authorizePage` maps the pathname to any-of grants (`src/lib/auth/page-route-permissions.ts`). Unlisted page → `/login?error=forbidden`.
8. APIs: `getSatelliteSession()` builds grants from the role row and checks the path the middleware stamped (`x-era-pathname`) against `src/lib/auth/api-route-permissions.ts`. Unlisted staff API → 403. Session-only: `/api/auth/me`, `/api/auth/session/refresh-permissions`, `/api/platform/billing-snapshot`. A missing `x-era-pathname` denies (a non-API path still passes, for server components). `POST /api/auth/logout` clears the staff cookie; the edge still requires that cookie, and the route is not a grant.
9. `/api/cron/service-due` is a declared handler exception (`HANDLER_GATE_EXCEPTIONS`): it keeps its cron secret and has no staff grant. Middleware is unchanged for it.

### D2 — Catalog keys (v1)

SSOT: `era-auto-service/src/lib/auth/permissions.ts`. Prefixes `screen:` / `api:` / `admin:` only. No `scope:*`.

| Package | Grants |
|---------|--------|
| `SERVICE_ADVISOR`, `TECHNICIAN` | `screen:home`, `screen:work_orders`, `screen:appointments`; `api:work_orders` (list, create, intake, labor, parts, parts order / status, shop floor, complete, pay), `api:appointments`, `api:vehicles`, `api:parts.catalog`, `api:tools`, `api:calendar` |
| `STO_MANAGER` | everything, including `screen:admin.settings`, `admin:settings`, `screen:admin.access`, `admin:access_manage` |
| `PLATFORM_MEMBER`, `SATELLITE_OPERATOR` | ops package |
| `BUSINESS_OWNER` | everything (bypass) |

The PRD split between advisor and technician is not enforced today, so both get the same package; tightening is a later matrix edit.

### D3 — Cutover

- A row with `permissionCatalogVersion = 0` and an empty or invalid list predates the matrix. It takes a template once: the system code's own, an alias (`ADMIN`, `MANAGER`, `OWNER`, `DIRECTOR` → `STO_MANAGER`; `ADVISOR`, `RECEPTION` → `SERVICE_ADVISOR`; `MECHANIC` → `TECHNICIAN`), or for any other legacy code the `SERVICE_ADVISOR` package with `cloneFromCode` set.
- From version 1 on, a valid array, including `[]`, is authoritative. A customized row does not gain new catalog keys; Reset or a manual grant adds them.

**Deliberate delta from pre-matrix access:** `/admin/settings` (local-only screen, no API) was open to any session; it now needs `screen:admin.settings` or `admin:settings`, which only the manager and the owner hold by default.

### D4 — Out of scope

Orchestrator matrix sync (Variant B), fleet desired-state (Variant C), per-user overrides, SHOW / SHIPPED / Pilot flip, Scaffold ✅ on AC-AUT-RBAC.

---

## Consequences

- Strip `api:work_orders` from the technician package → work-order list and every work-order sub-route return 403.
- Technician opening `/admin/settings` → redirect `/login?error=forbidden`.
- New staff route without a catalog row → 403 until `api-route-permissions.ts` lists it (inventory spec fails first).

## Acceptance

1. `__tests__/auto-rbac.spec.ts`, `auto-rbac-doors.spec.ts`, `auto-rbac-inventory.spec.ts`, `auto-rbac-role-name-grep.spec.ts` green.
2. `/admin/access` edits persist; refresh-permissions updates the JWT and the nav.
3. UAT-SMOKE AS-RBAC-01 steps listed and unchecked.
4. COVERAGE `AS-RBAC-01` = API (UI class SCREEN); AC-AUT-RBAC 🟡 out of BE rollup.
5. `npm run check:acceptance` PASS.
