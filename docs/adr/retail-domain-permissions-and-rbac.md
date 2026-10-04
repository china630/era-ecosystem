# ADR: Retail domain permissions and configurable RBAC (Variant A)

**Status:** Accepted — Variant A catalog v1  
**Date:** 2026-10-04  
**Coverage:** RET-RBAC-01 · AC-RET-RBAC 🟡 (out of BE rollup until field UAT)

**Related:**

- [fnb-domain-permissions-and-rbac.md](./fnb-domain-permissions-and-rbac.md) — reference shape
- [bank-domain-permissions-and-rbac.md](./bank-domain-permissions-and-rbac.md) — role assign on `/admin/access`
- [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md) §2 — one session read per handler

---

## Context

`era-retail-pos` had two role-name doors: line void (`SHIFT_SUPERVISOR`, `OUTLET_ADMIN` via `canVoidLine`) and cutover import (`assertRetailImportAccess` with a hardcoded role set). Every other staff page and API was session-only. `Role.permissionsJson` existed and stayed `[]`. Receipt void (`POST /api/receipts/[id]/void`) had no role check, so a cashier could void a whole receipt while being refused a single line.

## Decision

### D1 — Variant A on retail (local matrix)

1. System packages per org via `ensureSystemRoles` (`src/lib/auth/ensure-system-retail-roles.ts`): `CASHIER`, `SHIFT_SUPERVISOR`, `OUTLET_ADMIN` plus the control-plane trio `BUSINESS_OWNER`, `PLATFORM_MEMBER`, `SATELLITE_OPERATOR`. Login, SSO exchange, refresh-permissions and `GET /api/admin/roles` run it.
2. `Role.isSystem`, `Role.cloneFromCode`, `Role.permissionCatalogVersion` (migration `20261004120000_retail_role_rbac_fields`, table `"Role"`). Audit rows go to `satellite_audit_logs`.
3. SatAdmin screen `/admin/access`: role × permission matrix, clone, Reset to defaults, delete an unused custom role, assign a role to a user (`GET/PATCH /api/admin/users`; unknown role code → 400).
4. `admin:access_manage` default: `OUTLET_ADMIN` only. `OUTLET_ADMIN` does **not** bypass.
5. Bypass: platform super-admin and OrgOwner (`isOwner` / `BUSINESS_OWNER`) only. Only a bypass actor can move a user into or out of `BUSINESS_OWNER`.
6. JWT carries `permissions[]`; `POST /api/auth/session/refresh-permissions` re-signs after Save. A missing claim is an empty list.
7. Pages: middleware `authorizePage` maps the pathname to any-of grants (`src/lib/auth/page-route-permissions.ts`). Unlisted page → `/login?error=forbidden`. `/executive` and `/platform` are session-only; the page keeps its own platform capability check.
8. APIs: `getSatelliteSession()` builds grants from the role row and checks the path the middleware stamped (`x-era-pathname`) against `src/lib/auth/api-route-permissions.ts`. Unlisted staff API → 403. Session-only: `/api/auth/me`, `/api/auth/session/refresh-permissions`, `/api/platform/billing-snapshot`. A missing `x-era-pathname` denies (a non-API path still passes, for server components). `POST /api/auth/logout` clears the staff cookie; the edge still requires that cookie, and the route is not a grant.

### D2 — Catalog keys (v1)

SSOT: `era-retail-pos/src/lib/auth/permissions.ts`. Prefixes `screen:` / `api:` / `admin:` only. No `scope:*`.

| Package | Grants |
|---------|--------|
| `CASHIER` | `screen:home`, `screen:pos`, `screen:stock_check`, `screen:settings`; `api:receipts.sell`, `api:shifts.open`, `api:shifts.close`, `api:shifts.x_report`, `api:stock.check`, `api:presets`, `api:offline.sync`, `api:fiscal.devices`, `api:uploads`, `api:integrations.stock` |
| `SHIFT_SUPERVISOR` | cashier + `api:receipts.void_line`, `admin:import` |
| `OUTLET_ADMIN` | everything, including `admin:settings`, `screen:admin.access`, `admin:access_manage` |
| `PLATFORM_MEMBER`, `SATELLITE_OPERATOR` | cashier package (they could not void or import before) |
| `BUSINESS_OWNER` | everything (bypass) |

Doors: `api:receipts.void_line` on line void **and** receipt void; `admin:import` on `/admin/import`, `/admin/supplier-match`, `/admin/replenishment` and their APIs (`/api/import*`, `/api/replenishment/suggestions`, `/api/suppliers/invoices/match`); `admin:settings` on `/api/integrations/marketplace`.

### D3 — Cutover (zero behavior change on seed)

- A row with `permissionCatalogVersion = 0` and an empty or invalid list predates the matrix: its `[]` is the column default. It takes a template once: the system code's own, an alias (`ADMIN`, `MANAGER`, `OWNER`, `DIRECTOR` → `OUTLET_ADMIN`; `SUPERVISOR` → `SHIFT_SUPERVISOR`), or for any other legacy code the `CASHIER` package with `cloneFromCode` set.
- From version 1 on, a valid array, including `[]`, is authoritative. A customized row does not gain new catalog keys; Reset or a manual grant adds them.

**Deliberate deltas from pre-matrix access:** receipt void now needs `api:receipts.void_line` (cashiers lose an unchecked path; supervisors keep it). `/admin/supplier-match` and `/admin/replenishment` follow `admin:import` as the plan lists them. The marketplace webhook route (no UI; also checks `MARKETPLACE_WEBHOOK_SECRET`) moves to `admin:settings`.

### D4 — Out of scope

Orchestrator matrix sync (Variant B), fleet desired-state (Variant C), per-user overrides, a pharmacist package, SHOW / SHIPPED / Pilot flip, Scaffold ✅ on AC-RET-RBAC. Tightening `SATELLITE_OPERATOR` to read-only is a later matrix edit.

---

## Consequences

- Strip `api:receipts.void_line` from the supervisor package → both void routes 403.
- Cashier opening `/admin/import` → redirect `/login?error=forbidden`; the nav hides the link.
- New staff route without a catalog row → 403 until `api-route-permissions.ts` lists it (inventory spec fails first).

## Acceptance

1. `__tests__/retail-rbac.spec.ts`, `retail-rbac-doors.spec.ts`, `retail-rbac-inventory.spec.ts`, `retail-rbac-role-name-grep.spec.ts` green.
2. `/admin/access` edits persist; refresh-permissions updates the JWT and the nav.
3. UAT-SMOKE RET-RBAC-01 steps listed and unchecked.
4. COVERAGE `RET-RBAC-01` = API (UI class SCREEN); AC-RET-RBAC 🟡 out of BE rollup.
5. `npm run check:acceptance` PASS.
