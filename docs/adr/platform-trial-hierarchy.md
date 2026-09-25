# ADR: Platform trial hierarchy (org → satellite → module)

**Status:** Accepted  
**Date:** 2026-06-10  
**Supersedes (partially):** dev-unlock workaround in [`orchestrator-workspace-launcher.md`](./orchestrator-workspace-launcher.md) §3

## Context

Subscription trial was a flat `activeModules[]` on `OrganizationSubscription`, seeded with Finance slugs only at org registration. Industry satellites required super-admin or `ERA_DEV_UNLOCK_ALL_MODULES`. Product needs:

- One org-level trial clock at registration
- Satellites materialized when the owner connects a vertical
- Submodule access during trial gated by platform allowlist
- Super-admin can adjust trial dates at org / satellite / module with max-sync rules
- Department orgs snapshot parent entitlements at fork

Related: [`orchestrator-satellite-vs-module.md`](./orchestrator-satellite-vs-module.md), [`org-operating-mode.md`](./org-operating-mode.md).

## Decision

### 1. Trial end date (WHEN at register)

At org registration set `trialExpiresAt` and `expiresAt` (equal while `isTrial`):

**End of calendar month `(registration month + 3)` at 23:59:59.999 Asia/Baku.**

Example: register 2026-06-10 → trial ends **2026-09-30 23:59:59.999 Baku**.

Implementation: `computeTrialExpiresEndOfMonthBaku()` in `trial-date.util.ts`.

### 2. Org-only provision at register (WHAT)

On register create **only** `organization_subscriptions`:

- `isTrial: true`
- `trialExpiresAt`, `expiresAt` (same)
- `activeModules: []` (no auto industry gates)
- No `organization_satellite_entitlements` or module trial rows

### 3. Owner connect satellite

`POST /v1/subscription/connect-satellite { satelliteKey }`:

- Upsert `organization_satellite_entitlements` with `trialExpiresAt = org.trialExpiresAt`
- Add satellite gate slug + platform allowlisted submodules to `activeModules`

Finance uses satellite key `finance_core` (same rules).

### 4. Platform trial allowlist (WHAT modules)

`pricing_modules.trial_eligible_in_trial` — super-admin platform preconfig. Only allowlisted slugs are entitled during trial under a connected satellite.

### 5. Effective access

```
entitled(module) =
  satellite connected (or finance_core)
  AND module in platformTrialAllowlist(satellite)
  AND now <= effectiveUntil(module)
  AND NOT billing hard-block

effectiveUntil(module) =
  organization_modules.trial_expires_at
  ?? organization_satellite_entitlements.trial_expires_at
  ?? organization_subscriptions.trial_expires_at
```

### 6. Super-admin sync rules

| Action | Rule |
|--------|------|
| Extend/shrink **org** | Cascade to satellites/modules **without** `trialOverridden`; clamp overrides above new org date |
| Extend/shrink **satellite** | Modules without override under satellite follow; satellite = max(module dates under it) |
| Extend/shrink **module** only | Update module + `trialOverridden=true`; satellite = max(modules); org = max(satellites) |
| Shorten satellite | satellite = max(modules) — never shorter than longest module |

Premium modules: same trial/admin path; `PREMIUM_TRIAL_LOCKED` deprecated.

### 7. Department org

On first `DEPARTMENT` org linked to parent: **snapshot** parent `trialExpiresAt` + connected satellite/module rows. No live sync afterward — platform super-admin only.

### 8. Quotas

Independent of trial dates. Super-admin may assign free quota overrides per org (`quotaOverrides` JSON on subscription).

### 9. Deprecation

- `ERA_DEV_UNLOCK_ALL_MODULES` — remove after rollout
- Auto-fill all `industry_*` at register — removed
- `PREMIUM_TRIAL_LOCKED` during trial — removed

## Consequences

- Workspace: not connected → **Connect**; connected in trial → **Open**; expired → **Renew**
- Nafta pilot: owner connects Hotel/Clinic/FB; ops extends via super-admin org subscription UI
- Migration backfills satellite rows from existing `activeModules` industry gates

## References

- [`era-orchestrator/apps/api/src/subscription/`](../era-orchestrator/apps/api/src/subscription/)
- [`docs/CP-BILLING-MIGRATION.md`](../CP-BILLING-MIGRATION.md)
