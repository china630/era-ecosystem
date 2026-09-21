# ADR: Finance domain permissions and RBAC (Wave 5 — CP grant consumer)

**Status:** Accepted — Wave 5 (2026-09-18)  
**Date:** 2026-09-18  
**Coverage:** FIN-RBAC-01 · AC-FIN-RBAC 🟡 (out of Scaffold BE rollup; not SHOW / not GA)  
**Related:**

- [cp-domain-permissions-and-rbac.md](./cp-domain-permissions-and-rbac.md) — org matrix SoT + JWT `permissions[]`
- [clinic-domain-permissions-and-rbac.md](./clinic-domain-permissions-and-rbac.md) / [hotel-domain-permissions-and-rbac.md](./hotel-domain-permissions-and-rbac.md) — satellite Variant A (local matrix UI)
- Catalog SSOT: `packages/era-contracts` (`CP_PERMISSION`, `sessionHasAnyCpPermission`, legacy aliases)

---

## Context

Wave 4 put fleet-canon grants (`api:*` / `screen:*` / `admin:*`) on Orchestrator JWT from org-scoped `OrganizationRole.permissionsJson`. Finance still gated mutations on donor `UserRole` / `roles[]` (`@Roles`), so stripping `api:ledger.post` in CP `/settings/access` did not block GL.

Finance is **not** an industry satellite with a local role matrix. CP already owns org packages and the access UI. Wave 5 makes Finance a **grant consumer** of that JWT — same door language as CP, without a second matrix screen in `era-finance-core`.

---

## Decision

### D1 — Variant A only (consume CP; no Finance matrix UI)

| Concern | Owner |
|---------|--------|
| Role × permission matrix UI | Orchestrator `/settings/access` only |
| JWT `permissions[]` emission | Orchestrator (Wave 4) |
| Door enforcement in Finance | Nest `PermissionsGuard` + `@Permissions(...)` / policy helpers |
| UI hide/disable | Finance web `can(...keys)` via `@era/contracts` |

**Out of scope:** local Finance `/settings/access`, clone/custom roles in Finance DB, SHOW/GA, field Pilot flip.

### D2 — Door = permission keys, not `@Roles`

- Controllers and policies require catalog keys (`api:ledger.post`, `api:payroll.money`, …) from shared `@era/contracts`.
- Bypass: platform `isSuperAdmin` and org `isOwner` only. Donor role name alone grants nothing once JWT carries `permissions`.
- **Do not** leave `RolesGuard` + `@Roles(UserRole.*)` as the primary door on the same methods “for safety”.

### D3 — Post / Approve = `api:ledger.post`

Manual journal, cash/bank post, and other ledger Post/Approve paths require **`api:ledger.post`**. ACCOUNTANT package seed includes it; stripping the key in CP → Finance **403** even if donor role remains `ACCOUNTANT`.

Payroll money (PayrollRun create/approve/pay paths) requires **`api:payroll.money`**. HR_OFFICER / HR_MANAGER templates omit it.

### D4 — AuditorMutationGuard remains a locked belt

Global `AuditorMutationGuard` still blocks HTTP mutations for donor role **`AUDITOR`**. CP `/settings/access` **refuses write keys** on system `AUDITOR` and clones (`cloneFromCode=AUDITOR`). Checker only — never editor.

### D5 — Canonical keys only (no dual-read aliases)

JWT grants and doors use `api:` / `screen:` / `admin:` only. Bare codes (`accounting.post`) are not accepted. Re-login after cutover.

### D6 — Missing vs empty grants

- JWT `permissions: []` is authoritative (empty sticks).
- Missing `permissions` claim is **fail-closed** (empty grants). Local Finance login **issues** the donor template into the token at sign time; request-time refill is gone.

### D7 — Mutation doors use write keys (audit fix)

HTTP **mutations** must not require only `api:ledger.read`. Domain map: GL/money → `api:ledger.post`, invoices → `api:invoices.update`, inventory approve/complete → `api:inventory.approve`, purchases → `api:purchases.manage`, period close → `api:ledger.period_close`, org settings → `admin:org.settings`. Service policies take `PolicySubject` (JWT `permissions[]`) via `requireOrgPolicySubject`, not donor role alone.

---

## Consequences

### Positive

- Strip `api:ledger.post` in CP → Finance journal post **403**; UI `can()` hides Post.
- Strip `api:payroll.money` → PayrollRun money paths **403** for HR without the key.
- Single matrix SoT (Orchestrator); no dual UI drift.

### Cost / residual

- Field UAT / SHOW not claimed — AC-FIN-RBAC stays 🟡 out of Finance Scaffold BE rollup (AC-FIN-GL ✅ unchanged).
- Operators must edit grants in Orchestrator, not Finance settings.
- Mis-stripped ACCOUNTANT matrix locks GL until restored in CP.

### Out of scope

- Variant B sync for industry satellites.
- Per-user overrides beyond CP ManualGrant.
- Edition `ga` / Demo/TE flip from this wave.

---

## Evidence

- Nest: `PermissionsGuard`, policy helpers (`invoice-finance`, `hr-payroll`), `AuditorMutationGuard`
- Web: `apps/web/lib/role-utils.ts` `can()`
- Tests: `apps/api/test/rbac/rbac-bridge-sprint.spec.ts` (auditor belt)
- UAT-SMOKE § FIN-RBAC-01 (deny paths — lab open, not SHOW)
- Implementation-Matrix `AC-FIN-RBAC` 🟡 out of BE rollup
