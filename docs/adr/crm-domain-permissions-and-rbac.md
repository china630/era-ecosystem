# ADR: CRM domain permissions and configurable RBAC (Variant A)

**Status:** Accepted — Variant A catalog v1  
**Date:** 2026-10-04  
**Coverage:** CRM-RBAC-01 · AC-CRM-RBAC 🟡 (out of BE rollup until field UAT)

**Related:**

- [retail-domain-permissions-and-rbac.md](./retail-domain-permissions-and-rbac.md) — same mechanics, first satellite of this wave
- [fnb-domain-permissions-and-rbac.md](./fnb-domain-permissions-and-rbac.md) — reference shape
- [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md) §2 — one session read per handler

---

## Context

`era-crm` had one role-name door: lead assign (`src/lib/lead-assign-gates.ts`, `SALES_LEAD` and `BUSINESS_OWNER`), mirrored on the pipeline page by a client `ASSIGN_ROLES` check on `session.role.code`. Every other staff page and API was session-only, including lead import, pipeline rules and lookup writes. `Role.permissionsJson` existed and stayed `[]`. There was no `/admin/access` screen and no seed for role rows.

## Decision

### D1 — Variant A on CRM (local matrix)

1. System packages per org via `ensureSystemRoles` (`src/lib/auth/ensure-system-crm-roles.ts`): `SALES_AGENT`, `SALES_LEAD`, `FIELD_REP` plus the control-plane trio `BUSINESS_OWNER`, `PLATFORM_MEMBER`, `SATELLITE_OPERATOR`. Login, SSO exchange, refresh-permissions and `GET /api/admin/roles` run it.
2. `Role.isSystem`, `Role.cloneFromCode`, `Role.permissionCatalogVersion` (migration `20261004121000_crm_role_rbac_fields`, table `"Role"`). Audit rows go to `satellite_audit_logs`.
3. SatAdmin screen `/admin/access`: role × permission matrix, clone, Reset to defaults, delete an unused custom role, assign a role to a user (`GET/PATCH /api/admin/users`; unknown role code → 400).
4. `admin:access_manage` default: `SALES_LEAD` only. `SALES_LEAD` does **not** bypass.
5. Bypass: platform super-admin and OrgOwner (`isOwner` / `BUSINESS_OWNER`) only. Only a bypass actor can move a user into or out of `BUSINESS_OWNER`.
6. JWT carries `permissions[]`; `POST /api/auth/session/refresh-permissions` re-signs after Save. A missing claim is an empty list.
7. Pages: middleware `authorizePage` maps the pathname to any-of grants (`src/lib/auth/page-route-permissions.ts`). Unlisted page → `/login?error=forbidden`.
8. APIs: `getSatelliteSession()` builds grants from the role row and checks the path the middleware stamped (`x-era-pathname`) against `src/lib/auth/api-route-permissions.ts`. Unlisted staff API → 403. `/api/leads` and `/api/leads/[id]` carry two methods on one path: the map lists `api:leads.read` and `api:leads.write`, and each handler asserts its method grant. Session-only: `/api/auth/me`, `/api/auth/session/refresh-permissions`, `/api/platform/billing-snapshot`. A missing `x-era-pathname` denies (a non-API path still passes, for server components). `POST /api/auth/logout` clears the staff cookie; the edge still requires that cookie, and the route is not a grant.
9. `GET /api/auth/me` returns the generic shape (`role` string, `permissions`, `isOwner`, `isPlatformSuperAdmin`). The pipeline page shows the assign control from `permissions` / owner flags, not from a role name.

### D2 — Catalog keys (v1)

SSOT: `era-crm/src/lib/auth/permissions.ts`. Prefixes `screen:` / `api:` / `admin:` only. No `scope:*`: “my leads” stays the `mine=` query filter.

| Package | Grants |
|---------|--------|
| `SALES_AGENT`, `FIELD_REP` | `screen:home`, `screen:leads`, `screen:leads.detail`, `screen:inbox`, `screen:visits`; `api:leads.read`, `api:leads.write`, `api:leads.stage`, `api:leads.convert`, `api:leads.follow_up`, `api:inbox`, `api:visits`, `api:lookups`, `api:users.list` |
| `SALES_LEAD` | everything, including `api:leads.assign`, `admin:import`, `admin:pipeline`, `screen:admin.access`, `admin:access_manage` |
| `PLATFORM_MEMBER`, `SATELLITE_OPERATOR` | agent package |
| `BUSINESS_OWNER` | everything (bypass) |

Doors: `api:leads.assign` on `PATCH /api/leads/[id]/assign`; `admin:import` on `/admin/import`, `/api/leads/import`, `/api/leads/import/[batchId]`; `admin:pipeline` on `/admin/settings`, `/api/pipeline/rules`; `/api/mdm/voen-lookup` accepts `api:leads.write` or `admin:pipeline` (lead form and settings page both call it). Party / VÖEN stage rules stay domain validation, not grants.

### D3 — Cutover (zero behavior change on seed, with the plan's admin split)

- A row with `permissionCatalogVersion = 0` and an empty or invalid list predates the matrix. It takes a template once: the system code's own, an alias (`ADMIN`, `MANAGER`, `SALES_MANAGER`, `OWNER`, `DIRECTOR` → `SALES_LEAD`, which grants everything without the owner bypass; `AGENT`, `SALES_REP` → `SALES_AGENT`; `REP` → `FIELD_REP`), or for any other legacy code the `SALES_AGENT` package with `cloneFromCode` set.
- From version 1 on, a valid array, including `[]`, is authoritative. A customized row does not gain new catalog keys; Reset or a manual grant adds them.

**Deliberate deltas from pre-matrix access:** lead import (`/admin/import`, `/api/leads/import*`) and pipeline rules / settings (`/admin/settings`, `/api/pipeline/rules`) were open to any session; they now need `admin:import` / `admin:pipeline`, which only `SALES_LEAD` and the owner hold by default. Lead assign keeps its old allow-set.

### D4 — Out of scope

Orchestrator matrix sync (Variant B), fleet desired-state (Variant C), per-user overrides, `scope:leads.all` / row hiding, SHOW / SHIPPED / Pilot flip, Scaffold ✅ on AC-CRM-RBAC.

---

## Consequences

- Strip `api:leads.assign` from the sales lead package → assign returns 403 and the pipeline page hides the control.
- Agent opening `/admin/import` → redirect `/login?error=forbidden`; the nav hides the link.
- New staff route without a catalog row → 403 until `api-route-permissions.ts` lists it (inventory spec fails first).

## Acceptance

1. `__tests__/crm-rbac.spec.ts`, `crm-rbac-doors.spec.ts`, `crm-rbac-inventory.spec.ts`, `crm-rbac-role-name-grep.spec.ts`, `crm-pipe-negative.spec.ts` green.
2. `/admin/access` edits persist; refresh-permissions updates the JWT and the nav.
3. UAT-SMOKE CRM-RBAC-01 steps listed and unchecked.
4. COVERAGE `CRM-RBAC-01` = API (UI class SCREEN); AC-CRM-RBAC 🟡 out of BE rollup.
5. `npm run check:acceptance` PASS.
