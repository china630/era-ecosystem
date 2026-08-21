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

### 1. License / trial clock (WHEN at register)

Defaults follow **deployment topology** (`Organization.deploymentTopology`, axis B — not DEPARTMENT). Super-admin may always override (shrink, extend, perpetual).

| Topology | First provision | Super-admin |
|----------|-----------------|-------------|
| **SHARED** | System trial (`trialPeriodDays` / trial package → `computeTrialExpiresAtUtc`) | Same as today + perpetual checkbox (`expiresAt` / `trialExpiresAt` = null) |
| **DEDICATED** | No trial (`isTrial=false`), no expiry (`null`) | May grant a trial, set a contract end, or leave perpetual |
| **ONPREM** | Same as DEDICATED (perpetual paid/contract) | Same controls when the **cloud** control plane is SoR (tunnel). Air-gap is not a remote kill switch — contract / offline lease |

Self-serve register defaults to **SHARED**. Changing topology does **not** rewrite dates unless super-admin checks “apply topology license default”.

**Perpetual** = `trialExpiresAt` and `expiresAt` are `null`. Entitlement resolver already treats `until == null` as not expired.

Implementation: `licenseProvisionPlan()` in `license-defaults.ts`. Legacy end-of-month helper remains in `trial-date.util.ts` for older snapshots.

### 2. Org-only provision at register (WHAT)

On register create **only** `organization_subscriptions`:

- SHARED: `isTrial: true` and snapshotted `trialExpiresAt` / `expiresAt`
- DEDICATED / ONPREM: `isTrial: false`, both dates `null` (perpetual until admin sets a term)
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
- Nafta pilot: owner connects Hotel/Clinic/FB; ops sets topology (typically ONPREM/DEDICATED) and license on `/super-admin/orgs/{id}/subscription` (perpetual, ± months, or a date)
- Migration backfills satellite rows from existing `activeModules` industry gates

## References

- [`era-orchestrator/apps/api/src/subscription/`](../era-orchestrator/apps/api/src/subscription/)
- [`docs/CP-BILLING-MIGRATION.md`](../CP-BILLING-MIGRATION.md)
