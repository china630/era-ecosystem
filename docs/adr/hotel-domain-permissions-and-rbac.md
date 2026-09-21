# ADR: Hotel domain permissions and configurable RBAC (Variant A)

**Status:** Accepted — Variant A + Wave 1 hole-close + Wave 2 fleet-canon keys + Wave 3 screen/api split  
**Date:** 2026-09-10 (amended 2026-09-18 Wave 1 / Wave 2)  
**Coverage:** HOT-RBAC-01 · AC-HOT-RBAC 🟡 (out of BE rollup until field UAT)

**Related:**

- [clinic-domain-permissions-and-rbac.md](./clinic-domain-permissions-and-rbac.md) — clinic Variant A / Phase C fleet roadmap
- [cp-workforce-role-templates-and-security-admin.md](./cp-workforce-role-templates-and-security-admin.md) — CP role code assignment
- Plan: `.cursor/plans/hotel_rbac_seed_737f296c.plan.md`

---

## Context

Hotel PMS already stored `Role.permissionsJson` and the UI (`useAuth().can`) read DB grants via `/api/auth/me`. API guards still called hardcoded `permissionsForRole(session.role)` — so stripping a void grant from Hotel_Admin in the DB left void APIs open. JWT carried no `permissions[]`. Custom roles and a matrix screen were missing. Staff provision silently mapped unknown CP codes to `Receptionist`.

Clinic proved Variant A (system seed, clone, DB-authoritative guards, `CLINIC_ADMIN` not bypass). Hotel adopts the same pattern. Wave 2 renames legacy capability strings 1:1 into fleet-canon `api:*` / `admin:*` (no screen/api split in this wave).

---

## Decision

### D1 — Variant A on hotel (local matrix)

1. Seed eight system roles per org via `ensureSystemHotelRoles` from `ROLE_PERMISSIONS` template.
2. `Role.isSystem` + `Role.cloneFromCode` — Reset restores template (system) or donor effective grants (custom). Ensure fills **missing/invalid** `permissionsJson` only; a valid JSON array (including intentional `[]`) is left alone.
3. New SatAdmin screen `/settings/access` — role × permission matrix, clone, delete empty custom.
4. Permission `admin:access_manage` (default **Hotel_Admin** only). `/settings/users` stays on `admin:users`.
5. `assertPermission` / `assertAnyPermission` use session/DB grants — **role name grants nothing**.
6. Bypass: platform super-admin + OrgOwner (`isOwner` / `BUSINESS_OWNER`) only. **`Hotel_Admin` does not bypass.**
7. JWT carries `permissions[]`; `POST /api/auth/session/refresh-permissions` after Save (expands ALL for SA/owner like `/me`). API `getSessionFromHeaders` reloads grants from DB.
8. Page middleware maps coarse pathnames → **any-of** `screen:*` keys. APIs keep `api:*` / `admin:*`. Wave 3 catalogVersion **3** expands stored API grants into paired screens (strips of void etc. survive).
9. Provision: unknown `satelliteRole` → error; CP aliases map to system codes only.

### D2′ — Catalog keys (fleet canon, Wave 2)

Runtime hotel uses **only** fleet-canon strings. SSOT map: `era-hotel-pms/src/lib/auth/hotel-permission-rename.ts` + values in `permissions.ts`.

| Legacy (forbidden after cutover) | Canonical |
|---|---|
| `reservations:read` | `api:reservations.read` |
| `reservations:write` | `api:reservations.write` |
| `reservations:checkin` | `api:reservations.checkin` |
| `reservations:checkout` | `api:reservations.checkout` |
| `reservations:cancel` | `api:reservations.cancel` |
| `folio:read` | `api:folio.read` |
| `folio:charge` | `api:folio.charge` |
| `folio:payment` | `api:folio.payment` |
| `folio:void` | `api:folio.void` |
| `rooms:status` | `api:rooms.status` |
| `housekeeping:manage` | `api:housekeeping.manage` |
| `medical:manage` | `api:medical.manage` |
| `channel:manage` | `api:channel.manage` |
| `night_audit:run` | `api:night_audit.run` |
| `reports:read` | `api:reports.read` |
| `cash:shift` | `api:cash.shift` |
| `master_data:manage` | `admin:master_data` |
| `users:manage` | `admin:users` |
| `access:manage` | `admin:access_manage` |
| `api:import.elektraweb` | unchanged (Wave 1) |
| `api:integration.elektraweb_bridge` | unchanged (Wave 1) |

- `Role.permissionCatalogVersion` **= 2** after remap. Ensure remaps stored JSON 1:1 (no full template union — strips survive). Intentional `[]` bumps version only.
- Wave 1 additive (v0→1 import/bridge keys) still runs when jumping from v0 before remap.
- Dual-read on parse / JWT claims / `useAuth().can` / edge `sessionHasHotelPermission` (legacy → canon). **Writes** (PATCH matrix, serialize, JWT sign) emit canonical only.
- Ensure at catalog v2+ **heals** leftover legacy strings in `permissionsJson` without restoring stripped grants. `/api/auth/me` runs ensure (no-op writes skipped) so active sessions remaps without a forced re-login.
- No clinic-style data-scope / `scope:*`.

### D3 — Elektraweb import / bridge

- Import: grant `api:import.elektraweb` **∩** SKU `hotel_migration_pro` (platform SA bypass). Not a role-name allowlist.
- Bridge staff session **and** staff-minted `purpose=elektraweb-bridge` JWT: grant `api:integration.elektraweb_bridge` **∩** policy/env, **re-checked from DB** on each request. S2S JWT `purpose=elektraweb-bridge` with `role=bridge` skips matrix.
- Clone / matrix Save stamp `permissionCatalogVersion` so a later `ensure` does not re-add stripped Wave-1 keys.

### D4 — Out of scope

Orchestrator matrix sync (Variant B), per-user overrides, clinic-style data-scope, field UAT / SHOW.

**F&B:** landed separately — [fnb-domain-permissions-and-rbac.md](./fnb-domain-permissions-and-rbac.md).

---

## Consequences

- Removing `api:folio.void` from Hotel_Admin → void API 403 after refresh; nav/actions hide via `can()`.
- Clone e.g. `NIGHT_MANAGER` from NightAuditor → appears in `/settings/users` role select; Wave-1 additive adds bridge (donor has it) but **not** import.
- Saving an empty permission set (`[]`) sticks; ensure will not refill it from the role template.
- Housekeeper opening `/spa` by URL → forbidden (middleware).
- After upgrade: any authenticated `/api/auth/me` (or login/access) remaps role JSON; refresh-permissions / re-login so page JWT is canonical.

---

## Evidence

- Tests: `__tests__/hotel-rbac.spec.ts`, `__tests__/hotel-permission-rename.spec.ts`, `__tests__/hotel-page-route-inventory.spec.ts`, `__tests__/hotel-rbac-role-name-grep.spec.ts`, `__tests__/staff-provision.spec.ts`
- UAT-SMOKE §49 (open — not SHOW)
- Implementation-Matrix `AC-HOT-RBAC` 🟡 out of Scaffold BE rollup
