# ADR: Wholesale domain permissions and configurable RBAC (Variant A)

**Status:** Accepted — Variant A catalog v1  
**Date:** 2026-10-04  
**Coverage:** WS-RBAC-01 · AC-WHS-RBAC 🟡 (out of BE rollup until field UAT)

**Related:**

- [retail-domain-permissions-and-rbac.md](./retail-domain-permissions-and-rbac.md) — same mechanics, first satellite of this wave
- [fnb-domain-permissions-and-rbac.md](./fnb-domain-permissions-and-rbac.md) — reference shape
- [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md) §2 — one session read per handler

---

## Context

`era-wholesale` had no role-name door: every staff page and API was session-only, including import purchase orders and settings. `Role.permissionsJson` existed and stayed `[]`. There was no `/api/auth/me`, no `/admin/access` and no seed for role rows.

## Decision

### D1 — Variant A on wholesale (local matrix)

1. System packages per org via `ensureSystemRoles` (`src/lib/auth/ensure-system-wholesale-roles.ts`): `SALES_REP`, `WAREHOUSE_PICKER`, `WHOLESALE_MANAGER` plus the control-plane trio `BUSINESS_OWNER`, `PLATFORM_MEMBER`, `SATELLITE_OPERATOR`. Login, SSO exchange, refresh-permissions and `GET /api/admin/roles` run it.
2. `Role.isSystem`, `Role.cloneFromCode`, `Role.permissionCatalogVersion` (migration `20261004122000_wholesale_role_rbac_fields`, table `"Role"`). Audit rows go to `satellite_audit_logs`.
3. SatAdmin screen `/admin/access`: role × permission matrix, clone, Reset to defaults, delete an unused custom role, assign a role to a user (`GET/PATCH /api/admin/users`; unknown role code → 400).
4. `admin:access_manage` default: `WHOLESALE_MANAGER` only. It does **not** bypass.
5. Bypass: platform super-admin and OrgOwner (`isOwner` / `BUSINESS_OWNER`) only. Only a bypass actor can move a user into or out of `BUSINESS_OWNER`.
6. JWT carries `permissions[]`; `POST /api/auth/session/refresh-permissions` re-signs after Save. A missing claim is an empty list. New `GET /api/auth/me` returns DB grants for the shell.
7. Pages: middleware `authorizePage` maps the pathname to any-of grants (`src/lib/auth/page-route-permissions.ts`). Unlisted page → `/login?error=forbidden`.
8. APIs: `getSatelliteSession()` builds grants from the role row and checks the path the middleware stamped (`x-era-pathname`) against `src/lib/auth/api-route-permissions.ts`. Unlisted staff API → 403. Session-only: `/api/auth/me`, `/api/auth/session/refresh-permissions`, `/api/platform/billing-snapshot`. A missing `x-era-pathname` denies (a non-API path still passes, for server components). `POST /api/auth/logout` clears the staff cookie; the edge still requires that cookie, and the route is not a grant.

### D2 — Catalog keys (v1)

SSOT: `era-wholesale/src/lib/auth/permissions.ts`. Prefixes `screen:` / `api:` / `admin:` only. No `scope:*`.

| Package | Grants |
|---------|--------|
| `SALES_REP`, `WAREHOUSE_PICKER` | `screen:home`, `screen:orders`, `screen:pick_lists`; `api:orders`, `api:orders.confirm`, `api:orders.pay`, `api:orders.ttn`, `api:pick`, `api:pick_waves`, `api:credit_limit`, `api:edi.export`, `api:fx_preview` |
| `WHOLESALE_MANAGER` | everything, including `screen:admin.import_orders`, `screen:admin.settings`, `screen:admin.access`, `admin:import_orders`, `admin:access_manage` |
| `PLATFORM_MEMBER`, `SATELLITE_OPERATOR` | ops package |
| `BUSINESS_OWNER` | everything (bypass) |

Doors: `admin:import_orders` on `/api/import-orders` (all methods); `screen:admin.import_orders` on `/admin/import-orders`; `/api/payment-terms/due-date` and `/api/mdm/voen-lookup` accept `api:orders` or `admin:import_orders`. The PRD split between rep and picker is a catalog distinction granted to both; tightening is a later matrix edit.

### D3 — Cutover

- A row with `permissionCatalogVersion = 0` and an empty or invalid list predates the matrix. It takes a template once: the system code's own, an alias (`ADMIN`, `MANAGER`, `OWNER`, `DIRECTOR` → `WHOLESALE_MANAGER`; `SALES_AGENT`, `REP` → `SALES_REP`; `PICKER`, `STOREKEEPER` → `WAREHOUSE_PICKER`), or for any other legacy code the `SALES_REP` package with `cloneFromCode` set.
- From version 1 on, a valid array, including `[]`, is authoritative. A customized row does not gain new catalog keys; Reset or a manual grant adds them.

**Deliberate deltas from pre-matrix access:** import purchase orders and settings were open to any session; they now need the manager grants, as the plan lists them. Order, payment, TTN and pick flows keep their old allow-set (every ops role).

### D4 — Out of scope

Orchestrator matrix sync (Variant B), fleet desired-state (Variant C), per-user overrides, SHOW / SHIPPED / Pilot flip, Scaffold ✅ on AC-WHS-RBAC.

---

## Consequences

- Strip `api:orders.confirm` from the picker package → confirm returns 403 for pickers.
- Rep opening `/admin/import-orders` → redirect `/login?error=forbidden`.
- New staff route without a catalog row → 403 until `api-route-permissions.ts` lists it (inventory spec fails first).

## Acceptance

1. `__tests__/wholesale-rbac.spec.ts`, `wholesale-rbac-doors.spec.ts`, `wholesale-rbac-inventory.spec.ts`, `wholesale-rbac-role-name-grep.spec.ts` green.
2. `/admin/access` edits persist; refresh-permissions updates the JWT and the nav.
3. UAT-SMOKE WS-RBAC-01 steps listed and unchecked.
4. COVERAGE `WS-RBAC-01` = API (UI class SCREEN); AC-WHS-RBAC 🟡 out of BE rollup.
5. `npm run check:acceptance` PASS.
