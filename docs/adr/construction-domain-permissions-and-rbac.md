# ADR: Construction domain permissions and configurable RBAC (Variant A)

**Status:** Accepted — Variant A catalog v1  
**Date:** 2026-10-04  
**Coverage:** CN-RBAC-01 · AC-CON-RBAC 🟡 (out of BE rollup until field UAT)

**Related:**

- [retail-domain-permissions-and-rbac.md](./retail-domain-permissions-and-rbac.md) — same mechanics, first satellite of this wave
- [fnb-domain-permissions-and-rbac.md](./fnb-domain-permissions-and-rbac.md) — reference shape
- [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md) §2 — one session read per handler

---

## Context

`era-construction` had no role-name door: every staff page and API was session-only, including progress act approve (`POST /api/progress-acts/[id]/approve`). `Role.permissionsJson` existed and stayed `[]`. There was no `/api/auth/me`, no `/admin/access` and no seed for role rows.

## Decision

### D1 — Variant A on construction (local matrix)

1. System packages per org via `ensureSystemRoles` (`src/lib/auth/ensure-system-construction-roles.ts`): `SITE_MANAGER`, `ESTIMATOR`, `PROJECT_MANAGER` plus the control-plane trio `BUSINESS_OWNER`, `PLATFORM_MEMBER`, `SATELLITE_OPERATOR`. Login, SSO exchange, refresh-permissions and `GET /api/admin/roles` run it.
2. `Role.isSystem`, `Role.cloneFromCode`, `Role.permissionCatalogVersion` (migration `20261004124000_construction_role_rbac_fields`, table `"Role"`). Audit rows go to `satellite_audit_logs`.
3. SatAdmin screen `/admin/access`: role × permission matrix, clone, Reset to defaults, delete an unused custom role, assign a role to a user (`GET/PATCH /api/admin/users`; unknown role code → 400).
4. `admin:access_manage` default: `PROJECT_MANAGER` only. It does **not** bypass.
5. Bypass: platform super-admin and OrgOwner (`isOwner` / `BUSINESS_OWNER`) only. Only a bypass actor can move a user into or out of `BUSINESS_OWNER`.
6. JWT carries `permissions[]`; `POST /api/auth/session/refresh-permissions` re-signs after Save. A missing claim is an empty list. New `GET /api/auth/me` returns DB grants for the shell.
7. Pages: middleware `authorizePage` maps the pathname to any-of grants (`src/lib/auth/page-route-permissions.ts`). Unlisted page → `/login?error=forbidden`.
8. APIs: `getSatelliteSession()` builds grants from the role row and checks the path the middleware stamped (`x-era-pathname`) against `src/lib/auth/api-route-permissions.ts`. Unlisted staff API → 403. Session-only: `/api/auth/me`, `/api/auth/session/refresh-permissions`, `/api/platform/billing-snapshot`. A missing `x-era-pathname` denies (a non-API path still passes, for server components). `POST /api/auth/logout` clears the staff cookie; the edge still requires that cookie, and the route is not a grant.

### D2 — Catalog keys (v1)

SSOT: `era-construction/src/lib/auth/permissions.ts`. Prefixes `screen:` / `api:` / `admin:` only. No `scope:*`.

| Package | Grants |
|---------|--------|
| `SITE_MANAGER`, `ESTIMATOR` | `screen:home`, `screen:projects`, `screen:projects.detail`, `screen:field_ops`, `screen:material_requisitions`; `api:projects`, `api:boq` (plan vs actual), `api:daily_logs`, `api:punch_list`, `api:gantt`, `api:requisitions`, `api:acts.approve`, `api:timesheets.import`, `api:equipment.hours`, `api:cde`, `api:subcontractor_claims` |
| `PROJECT_MANAGER` | everything, including `screen:admin.settings`, `screen:admin.access`, `admin:access_manage` |
| `PLATFORM_MEMBER`, `SATELLITE_OPERATOR` | ops package |
| `BUSINESS_OWNER` | everything (bypass) |

Act approve stays on every ops package because any session could approve before; moving it to the manager is a later matrix edit. The APPROVED reopen refusal (`progressActReopenDenied`) stays a domain rule. `/api/calendar/working-day` accepts `api:timesheets.import` or `api:daily_logs`; `/api/counterparties/voen-preview` accepts `api:subcontractor_claims` or `api:projects`.

### D3 — Cutover

- A row with `permissionCatalogVersion = 0` and an empty or invalid list predates the matrix. It takes a template once: the system code's own, an alias (`ADMIN`, `MANAGER`, `OWNER`, `DIRECTOR`, `CHIEF_ENGINEER` → `PROJECT_MANAGER`; `FOREMAN` → `SITE_MANAGER`; `QS` → `ESTIMATOR`), or for any other legacy code the `SITE_MANAGER` package with `cloneFromCode` set.
- From version 1 on, a valid array, including `[]`, is authoritative. A customized row does not gain new catalog keys; Reset or a manual grant adds them.

**Deliberate delta from pre-matrix access:** `/admin/settings` (local-only screen) was open to any session; it now needs `screen:admin.settings`, which only the manager and the owner hold by default.

### D4 — Out of scope

Orchestrator matrix sync (Variant B), fleet desired-state (Variant C), per-user overrides, read-only `SATELLITE_OPERATOR` package, SHOW / SHIPPED / Pilot flip, Scaffold ✅ on AC-CON-RBAC.

---

## Consequences

- Strip `api:acts.approve` from the site manager package → approve returns 403 for site managers.
- Estimator opening `/admin/settings` → redirect `/login?error=forbidden`.
- New staff route without a catalog row → 403 until `api-route-permissions.ts` lists it (inventory spec fails first).

## Acceptance

1. `__tests__/construction-rbac.spec.ts`, `construction-rbac-doors.spec.ts`, `construction-rbac-inventory.spec.ts`, `construction-rbac-role-name-grep.spec.ts` green.
2. `/admin/access` edits persist; refresh-permissions updates the JWT and the nav.
3. UAT-SMOKE CN-RBAC-01 steps listed and unchecked.
4. COVERAGE `CN-RBAC-01` = API (UI class SCREEN); AC-CON-RBAC 🟡 out of BE rollup.
5. `npm run check:acceptance` PASS.
