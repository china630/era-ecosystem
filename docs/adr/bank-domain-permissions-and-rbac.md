# ADR: Bank domain permissions and configurable RBAC (Variant A)

**Status:** Accepted — Variant A catalog v1  
**Date:** 2026-09-20  
**Coverage:** BANK-RBAC-01 · AC-BNK-RBAC 🟡 (out of BE rollup until field UAT)

**Related:**

- [fnb-domain-permissions-and-rbac.md](./fnb-domain-permissions-and-rbac.md) — clone pattern
- [hotel-domain-permissions-and-rbac.md](./hotel-domain-permissions-and-rbac.md)
- [era-bank-core.md](./era-bank-core.md) — maker-checker / SSO+SKU consumption (not CP matrix UI)
- Plan: Bank Variant A RBAC

---

## Context

`era-bank` gated ops by `OpsRole.code` name (`ROLE_NAV_ALLOW`, `limitsJson.canApprove`). JWT carried no `permissions[]`. Page middleware was session-only. BFF `proxyRequest` forwarded any authenticated session to any engine module. Clinic, hotel, and F&B already proved Variant A (role = package, door = grant). Bank is a local-matrix satellite (like F&B), not a Finance-style CP JWT consumer.

## Decision

### D1 — Variant A on bank ops (local matrix)

1. Seed system roles per org via `ensureSystemBankRoles` from templates in `era-bank/src/lib/auth/permissions.ts`.
2. `OpsRole.isSystem` + `cloneFromCode` + `permissionCatalogVersion` (= 1). Valid JSON array (including intentional `[]`) is left alone on ensure.
3. SatAdmin `/admin/access` — role × permission matrix, clone, Reset, delete unused custom; staff role assign via `/api/admin/users`.
4. `admin:access_manage` default **BRANCH_MANAGER** (and owner bypass). **`BRANCH_MANAGER` does not bypass.**
5. Bypass: platform super-admin + OrgOwner (`isOwner` / `BUSINESS_OWNER`) only.
6. JWT carries `permissions[]`; `POST /api/auth/session/refresh-permissions` after Save. APIs prefer DB grants when OpsUser-backed.
7. Page middleware maps pathnames → any-of `screen:*`. BFF uses `api:*` / `admin:*`.
8. Kit CP trio (`BUSINESS_OWNER`, `PLATFORM_MEMBER`, `SATELLITE_OPERATOR`) are system packages. Unknown **ops** role codes on assign fail. Do not invent a fourth CP role.

### D2 — Catalog keys (v1)

SSOT: `era-bank/src/lib/auth/permissions.ts`. Prefixes `api:` / `screen:` / `admin:` only. No clinic `scope:*`. No legacy dual-read (greenfield).

Numeric amount caps stay in `limitsJson` (`maxDebitMinor`, `dailyPostingLimitAzn`). Flags (`canApprove`, `canScreen`, …) move to grants.

### D3 — Axes (do not collapse)

| Layer | Rule |
|-------|------|
| Identity | JWT `sub` + role **code** (package name) |
| Bind | `OpsUser.branchId` |
| Entitlement | `industry_banking` + `banking_*` SKUs unchanged |
| Grants | `OpsRole.permissionsJson` — doors after JWT |
| SoD + limits | Engine maker≠checker + numeric limits — grant ∩ SoD ∩ limit for approve |

DBO Open API key scopes and Nest staff matrix duplication are **out of scope**. Maker-checker in `era-bank-core` is not replaced by a grant.

### D4 — Out of scope

Orchestrator matrix sync (Variant B), per-user overrides, SHOW / SHIPPED / Pilot flip, Scaffold ✅ on AC-BNK-RBAC, DBO channel RBAC.

## Consequences

- Strip approve from manager → BFF 403; AML without `screen:cards` → page 403.
- `BRANCH_MANAGER` with empty `[]` sees nothing (name grants nothing).
- Engine still rejects maker=checker even when approve grant is present.

## Acceptance

1. Defaults reproduce prior role doors + close page/BFF holes.  
2. `/admin/access` edits persist; refresh-permissions updates JWT.  
3. UAT-SMOKE: strip approve; AML vs cards; refresh after Save.  
4. COVERAGE `BANK-RBAC-01` = SCREEN; AC-BNK-RBAC 🟡 out of BE rollup.  
5. `npm run check:acceptance` PASS.
