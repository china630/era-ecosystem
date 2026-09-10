# ADR: Hotel domain permissions and configurable RBAC (Variant A)

**Status:** Accepted — Variant A shipped (system seed + matrix UI + DB guards)  
**Date:** 2026-09-10  
**Coverage:** HOT-RBAC-01 · AC-HOT-RBAC 🟡 (out of BE rollup until field UAT)

**Related:**

- [clinic-domain-permissions-and-rbac.md](./clinic-domain-permissions-and-rbac.md) — clinic Variant A / Phase C fleet roadmap
- [cp-workforce-role-templates-and-security-admin.md](./cp-workforce-role-templates-and-security-admin.md) — CP role code assignment
- Plan: `.cursor/plans/hotel_rbac_seed_737f296c.plan.md`

---

## Context

Hotel PMS already stored `Role.permissionsJson` and the UI (`useAuth().can`) read DB grants via `/api/auth/me`. API guards still called hardcoded `permissionsForRole(session.role)` — so stripping `folio:void` from Hotel_Admin in the DB left void APIs open. JWT carried no `permissions[]`. Custom roles and a matrix screen were missing. Staff provision silently mapped unknown CP codes to `Receptionist`.

Clinic proved Variant A (system seed, clone, DB-authoritative guards, `CLINIC_ADMIN` not bypass). Hotel adopts the same pattern **without** renaming existing keys to `screen:*` / `api:*`.

---

## Decision

### D1 — Variant A on hotel (local matrix)

1. Seed eight system roles per org via `ensureSystemHotelRoles` from `ROLE_PERMISSIONS` template.
2. `Role.isSystem` + `Role.cloneFromCode` — Reset restores template (system) or donor effective grants (custom). Ensure fills **missing/invalid** `permissionsJson` only; a valid JSON array (including intentional `[]`) is left alone.
3. New SatAdmin screen `/settings/access` — role × permission matrix, clone, delete empty custom.
4. New permission `access:manage` (default **Hotel_Admin** only). `/settings/users` stays on `users:manage`.
5. `assertPermission` / `assertAnyPermission` use session/DB grants — **role name grants nothing**.
6. Bypass: platform super-admin + OrgOwner (`isOwner` / `BUSINESS_OWNER`) only. **`Hotel_Admin` does not bypass.**
7. JWT carries `permissions[]`; `POST /api/auth/session/refresh-permissions` after Save (expands ALL for SA/owner like `/me`). API `getSessionFromHeaders` reloads grants from DB.
8. Page middleware maps coarse pathnames → **any-of** existing `PERMISSIONS` (FO/HK/folio/executive/front-cash/settings/access).
9. Provision: unknown `satelliteRole` → error; CP aliases map to system codes only.

### D2 — Keep hotel permission catalog keys

Do not rename `reservations:read`, `folio:void`, … to clinic-style `screen:` / `api:` in this wave. Catalog SSOT: `era-hotel-pms/src/lib/auth/permissions.ts`.

### D3 — Out of scope

Orchestrator matrix sync (Wave B), F&B, per-user overrides, clinic-style data-scope, field UAT / SHOW.

---

## Consequences

- Removing `folio:void` from Hotel_Admin → void API 403 after refresh; nav/actions hide via `can()`.
- Clone e.g. `NIGHT_MANAGER` from NightAuditor → appears in `/settings/users` role select.
- Elektraweb import entitlement remains separate (`canRunHotelImport`) — not a matrix bypass for FO screens.
- Saving an empty permission set (`[]`) sticks; ensure will not refill it from the role template.

---

## Evidence

- Tests: `__tests__/hotel-rbac.spec.ts`, `__tests__/staff-provision.spec.ts`
- UAT-SMOKE §45 (open — not SHOW)
- Implementation-Matrix `AC-HOT-RBAC` 🟡 out of Scaffold BE rollup
