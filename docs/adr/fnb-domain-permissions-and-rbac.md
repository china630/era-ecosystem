# ADR: F&B domain permissions and configurable RBAC (Variant A)

**Status:** Accepted — Variant A catalog v1  
**Date:** 2026-09-19  
**Coverage:** FNB-RBAC-01 · AC-FNB-RBAC 🟡 (out of BE rollup until field UAT)

**Related:**

- [clinic-domain-permissions-and-rbac.md](./clinic-domain-permissions-and-rbac.md)
- [hotel-domain-permissions-and-rbac.md](./hotel-domain-permissions-and-rbac.md)
- [era-kafe-edition.md](./era-kafe-edition.md) — owner login ≠ PIN; outlet bind
- Plan: F&B Variant A RBAC

---

## Context

`era-fnb-pos` gated APIs with hardcoded `requireAnyRole(FB_*)`. Pages had session-only middleware (kitchen PIN could open `/admin/menu` UI). `Role.permissionsJson` existed but stayed `[]`. Kafe pay used `session.role === FB_WAITER`. Clinic and hotel already proved Variant A (role = package, door = grant).

## Decision

### D1 — Variant A on F&B (local matrix)

1. Seed four system roles per org via `ensureSystemFnbRoles` from edition-aware templates (`hotel` vs `kafe`).
2. `Role.isSystem` + `Role.cloneFromCode` + `permissionCatalogVersion` (= 1 at cutover). Valid JSON array (including intentional `[]`) is left alone on ensure.
3. SatAdmin screen `/admin/access` — role × permission matrix, clone, Reset, delete unused custom.
4. `admin:access_manage` default **FB_MANAGER** only. `FB_MANAGER` does **not** bypass.
5. Bypass: platform super-admin + OrgOwner (`isOwner` / `BUSINESS_OWNER`) only — **never** on PIN sessions.
6. JWT carries `permissions[]`; `POST /api/auth/session/refresh-permissions` after Save. APIs prefer DB grants when User-backed; PIN sessions use Role row for `pinRole` package.
7. Page middleware maps pathnames → any-of `screen:*`. APIs use `api:*` / `admin:*`.
8. Provision: aliases only; unknown `satelliteRole` fails. Roster `pinRole` synced from role code.

### D2 — Catalog keys (v1)

SSOT: `era-fnb-pos/src/lib/auth/permissions.ts`. Prefixes `api:` / `screen:` / `admin:` only. No clinic `scope:*`. No legacy dual-read (greenfield).

Kafe template: `FB_WAITER` **omits** `api:tickets.pay`. Hotel waiter includes pay + hotel bridge keys. Ensure fills from the org’s `FnbOrgProfile.edition`.

### D3 — PIN mint and outlet bind (not matrix cells)

| Layer | Rule |
|-------|------|
| Identity | Owner: login/SSO. Floor: PIN on `StaffRoster` |
| Bind | PIN requires `roster.outletId`; mismatch → 401; unbound → 403 `PIN_OUTLET_UNBOUND` |
| Device outlet | `POST /api/outlets/select` requires `admin:outlet_bind` (owner/manager). PIN cannot rebind |
| Entitlement | `fnb_waiter_pin` pack / `fnb_kitchen_kds` unchanged |
| Grants | After JWT, doors are permissions only |

### D4 — Out of scope

Orchestrator matrix sync (Variant B), per-user overrides, SHOW / SHIPPED / Pilot flip, Scaffold ✅ on AC-FNB-RBAC.

---

## Consequences

- Strip void grant from manager → API 403; kitchen without `screen:admin.menu` → page 403.
- SSO owner gains admin doors via bypass (closes prior hole where SSO failed `requireAnyRole(FB_MANAGER)`).
- Existing empty `permissionsJson` on roles gets template on first ensure after upgrade unless already a valid array.

## Acceptance

1. Defaults reproduce prior role doors + close page UI holes.  
2. `/admin/access` edits persist; refresh-permissions updates JWT.  
3. UAT-SMOKE: strip void; unbound PIN; kafe waiter pay 403.  
4. COVERAGE `FNB-RBAC-01` = SCREEN; AC-FNB-RBAC 🟡 out of BE rollup.  
5. `npm run check:acceptance` PASS.
