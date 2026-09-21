# ADR: Control-plane domain permissions and RBAC (Variant A)

**Status:** Accepted — Wave 4 (2026-09-18)  
**Date:** 2026-09-18  
**Relates:** [clinic-domain-permissions-and-rbac.md](./clinic-domain-permissions-and-rbac.md), [hotel-domain-permissions-and-rbac.md](./hotel-domain-permissions-and-rbac.md), [cp-core-workforce-hub.md](./cp-core-workforce-hub.md)

## Context

Orchestrator JWT already carried `permissions[]`, but values were a **hardcoded** map (`billing.manage`, …) from `role-permissions.ts`, and API doors used **`RolesGuard` + `@Roles(UserRole.*)`** (role-name packages). Global Prisma `Role` / `Permission` / `RolePermission` tables exist with **global** `Role.code @unique` and are **not** used as org matrix SoT.

Satellites (hotel/clinic Waves 1–3) use Variant A: role = package, door = grants (`api:` / `screen:` / `admin:`), valid `[]` authoritative, missing JWT fail-closed.

## Decision

### D1 — OrganizationRole (org-scoped package)

- Table `organization_roles`: `(organizationId, code)` unique, `permissionsJson`, `isSystem`, `cloneFromCode`, `permissionCatalogVersion`.
- `OrganizationMembership.organizationRoleId` FK (nullable for migration); **`role UserRole` kept** as **Finance donor** until Wave 5.
- Custom roles: `^[A-Z][A-Z0-9_]{2,31}$`, must not collide with `UserRole` enum; delete only when `userCount=0`.
- `ensureSystemCpRoles(orgId)` upserts 12 system rows; refills **invalid/missing** JSON only; honors valid `[]`.

Global `roles` / `permissions` / `role_permissions`: **legacy unused** for Wave 4 — do not write org matrix there.

### D2 — Catalog language (fleet canon)

SSOT: `apps/api/src/auth/cp-permissions.ts`.

- CP doors: `api:org.*`, `api:billing.*`, `api:workforce.*`, `screen:workspace.*`, `screen:settings.*`, `admin:access_manage`.
- Finance-facing keys seeded into JWT for Wave 5 (`api:ledger.*`, `api:payroll.*`, …) — **CP `PermissionsGuard` does not enforce them**.
- **No** satellite industry keys (`screen:sanatorium`, `folio:void`, …).
- After cutover JWT emits **only** `api:` / `screen:` / `admin:` — not legacy `billing.manage`.

### D3 — Bypass and locked keys

| Actor | Bypass CP keys? |
|-------|-----------------|
| Platform `isSuperAdmin` | Yes |
| Org `isOwner` | Yes (SaaS owner) |
| `ADMIN` / other ops | **No** — matrix applies |

**Locked** (cannot grant via access UI; OWNER reaches via `isOwner` bypass):

- `api:org.transfer_ownership`
- `api:billing.payment_method`
- `api:workforce.bootstrap` (scope bootstrap + commercial-link bind)
- `admin:platform`

AUDITOR template: no write/workforce mutate keys. Access PATCH rejects extra keys on `AUDITOR` and clones from AUDITOR (checker only). Finance keeps `AuditorMutationGuard` belt.

### D3b — Former `@Roles` → catalog keys (summary)

| Former roles on door | Catalog key(s) |
|----------------------|----------------|
| OWNER, ADMIN (team list) | `api:org.members.read` |
| OWNER, ADMIN (invite/approve) | `api:org.invites` / `api:org.members.write` |
| OWNER only (transfer) | `api:org.transfer_ownership` (locked) |
| OWNER, ADMIN, DIRECTOR (departments) | `api:org.departments` |
| OWNER (billing/subscription) | `api:billing.manage` (+ isOwner bypass) |
| OWNER, HR_MANAGER, DEPARTMENT_HEAD (lists) | `api:workforce.read` |
| OWNER, HR_MANAGER (hire/transfer) | `api:workforce.hire` |
| OWNER, HR_MANAGER (terminate / reprovision) | `api:workforce.terminate` / `reprovision` |
| OWNER only (scope bootstrap / commercial links) | `api:workforce.bootstrap` (locked) |
| OWNER, HR_MANAGER (domain writes) | matching `api:workforce.*` package |

DEPARTMENT_HEAD template is **read-only** workforce (`api:workforce.read` + screen) — approve absences/timesheets that historically allowed DEPT use the **read** key on those handlers.

### D4 — Guards

- `PermissionsGuard` + `@RequirePermissions(...)` (any-of) on CP workforce / org / billing / subscription / access controllers.
- **Do not** leave `RolesGuard` on the same methods “for safety”.
- Hire into satellites still sends **`satelliteRole` code**, not CP JSON.

### D5 — Wave 5 (Finance) — landed 2026-09-18

Finance reads JWT `permissions[]` and enforces catalog keys (`PermissionsGuard` / `can()`). Stripping `api:ledger.post` in CP matrix **blocks** Finance GL. See [finance-domain-permissions-and-rbac.md](./finance-domain-permissions-and-rbac.md). Donor `role` / `roles[]` remain package labels; doors are grants.

### D6 — UI

- `/settings/access` — matrix (not workforce security position × satelliteRole).
- Team invite/role picker uses org roles API.
- Sidebar `can(screen:*)` for access / holdings / team.
- Finance has **no** local matrix UI — operators edit grants here only.

## Consequences

- Positive: org-tunable CP doors; same grant language as satellites; empty matrix sticks; Finance Wave 5 consumes the same JWT grants.
- Cost: migrate memberships to `organizationRoleId`.
- Risk closed for Finance GL: stripped `api:ledger.post` now blocks posting (see finance ADR).
