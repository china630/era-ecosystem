# ADR: Billing SOFT/HARD block — one matrix, enforced by Finance and every industry satellite

**Status:** Accepted  
**Date:** 2026-10-08  
**Related:** [CP-BILLING-MIGRATION.md](../CP-BILLING-MIGRATION.md) · [org-operating-mode.md](org-operating-mode.md) · [asia-baku-clock.md](asia-baku-clock.md)

## Context

The orchestrator sets `billing_status` per organization (`organizations.billing_status`, overridden by `tenant_billing.billing_status` when that row exists):

| Cron (Asia/Baku) | Effect |
|---|---|
| 1st, 00:00 | Invoice for the previous month; billed orgs → `SOFT_BLOCK` |
| 6th, 00:00 | `SOFT_BLOCK` with an unpaid previous-month invoice → `HARD_BLOCK` |
| Payment provider finalize | → `ACTIVE` |

Before this change only Finance enforced the status (`ControlPlaneEntitlementGuard`). Industry satellites ignored it, so a `HARD_BLOCK` org kept full write access there. The super-admin had no way to lift a block for an org that pays on other terms: "+1 month" moved the license date but left `HARD_BLOCK` in place.

## Decision

### 1. One matrix, in the orchestrator

`POST /internal/v1/entitlements/validate` (`EntitlementsService`) stays the only rule set:

| Status | Denied (HTTP 402) | Code |
|---|---|---|
| `SOFT_BLOCK` | Paths containing `/export`, `/pdf`, `/xlsx`, `/xml`, `/download`, `/tax-export` (e.g. hotel `/api/reports/pack/download`) | `BILLING_SOFT_BLOCK_EXPORTS` |
| `HARD_BLOCK` | Every non-GET/HEAD/OPTIONS call, except `/api/early-access/*`, `/api/auth/*` (session maintenance) and ERA invoice payment (`/api/billing/checkout`, billing webhooks) | `BILLING_HARD_BLOCK_READ_ONLY` |

A super-admin `User` (resolved from DB by `userId`) bypasses. The route is `@Public()` (user JWT guard skipped) and accepts the same service tokens as the subscription snapshot (`ORCHESTRATOR_INTERNAL_SERVICE_TOKEN`, `CONTROL_PLANE_SERVICE_TOKEN`, `SATELLITE_EVENT_SERVICE_TOKEN`). Without `@Public()` the JWT guard rejects that bearer and satellites treat the 401 as an unreachable control plane. New export markers are added once in `isExportPath`, never in a satellite.

Hotel cash, check-in, visits, and postings are writes: under `HARD_BLOCK` they get 402; lists and cards stay readable.

### 2. Satellites enforce through `@era/satellite-kit`

- `readSatelliteStaffSession` (the single staff-session entry of hotel, clinic, F&B, retail, CRM, wholesale, logistics, construction, auto service, bank ops) calls `assertSatelliteBillingAllows` after the session and user row verify. Denied → throws `SatelliteBillingBlockedError` (`status` 402, `code` from the orchestrator).
- Method and path come from request headers stamped by the kit middleware (`x-era-pathname`, `x-era-method`). Client copies of `x-era-method` are overwritten; passthrough prefixes (no header clone, for multipart bodies) apply to non-GET/HEAD only, so reads there are stamped like any staff API; on passthrough writes a client copy must equal the real verb or the request gets 401. A call without the stamp counts as a write.
- Platform super-admin by email (`isPlatformSuperAdminUser`) skips the gate: a local satellite staff row is not an orchestrator `User`, so the satellite does not send `userId`.
- Cache: an `ACTIVE` answer is reused for 60 s. Blocked orgs are re-checked on every call. Orchestrator unreachable: the last known status (up to 15 min) decides; with no cache, reads pass and writes get 503 `BILLING_STATUS_UNAVAILABLE`, so an outage never reopens posting for a blocked org. `/api/auth/*` stays open in both fallbacks, as in the matrix.
- Off switch outside production only: `ERA_BILLING_ENFORCEMENT=off`, `ERA_DEV_UNLOCK_ALL_MODULES=1`, or jest (`NODE_ENV=test`) unless `ERA_BILLING_ENFORCEMENT=on`.
- Each app's `handleRouteError` maps the error to `{ error, code, billingStatus }` with its status (one guard next to `IndustryModuleInactiveError`), so a block is never a 500. The guard is imported from the subpath `@era/satellite-kit/billing/gate`, so jest mocks of the kit barrel do not drop it.
- Banner: `EraAppRouteShell` renders `SatelliteBillingBanner`, which reads `GET /api/platform/billing-status`. The handler lives in the kit (`@era/satellite-kit/billing/status-route`); each app's `app/api/platform/billing-status/route.ts` only re-exports it (RBAC API inventories list it in `HANDLER_GATE_EXCEPTIONS`: the handler verifies the token itself). Texts (az/ru/en) match Finance `billingEnforcement.*`. The banner only shows what the API already enforces.
- Out of scope: `era-bank-core`, `era-bank-dbo`, data-hub (no `readSatelliteStaffSession`). Finance keeps its own guard.

### 3. "Covered until" lifts the block

`organization_subscriptions.billing_covered_until` (nullable). Super-admin action on `/super-admin/orgs/{id}/subscription` → `PATCH /v1/admin/organizations/:id/billing-coverage { coveredUntil: "YYYY-MM-DD" | null }`:

- sets `expiresAt` and `billingCoveredUntil` to the end of that Asia/Baku day (must be today or later);
- sets `billing_status = ACTIVE` on `organizations` and on `tenant_billing` when the row exists;
- writes `platform_audit_logs` (`addonSlug=billing`, `BILLING_COVERAGE_SET` / `BILLING_COVERAGE_CLEARED`).

The 1st-of-month run skips orgs whose `billingCoveredUntil` reaches the end of the billed month: no invoice, no `SOFT_BLOCK`. The 6th-of-month escalation is unchanged (it only lifts `SOFT_BLOCK` orgs). Issued invoices are not marked paid. The payment webhook still sets `ACTIVE` and leaves `billingCoveredUntil` alone. `isBlocked` stays a separate switch (Finance `SUBSCRIPTION_SUSPENDED_READ_ONLY`).

## Consequences

- Every staff API call of a non-`ACTIVE` org costs one orchestrator round trip; `ACTIVE` orgs cost at most one per minute per satellite process.
- A satellite started without a reachable orchestrator rejects writes until the first successful check (or the dev off switch).
- Partial coverage (ends mid-month) does not suppress that month's invoice.
- Finance home 403 `Tenant context required` (same release): `DisputeFreezeGuard` reads `organization_security_states` by raw SQL with the JWT org (guards run before `TenantContextInterceptor`), and the interceptor subscribes to the handler inside `tenantContextStorage.run`, so ALS covers the handler's awaits.
