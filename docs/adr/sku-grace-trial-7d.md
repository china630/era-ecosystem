# ADR: SKU lifetime grace trial (7 days)

**Status:** Accepted  
**Date:** 2026-11-03  
**Related:** [CONTROL_PLANE_ARCHITECTURE.md](../CONTROL_PLANE_ARCHITECTURE.md) · [era-commercial-catalog.md](./era-commercial-catalog.md) · [platform-trial-hierarchy.md](./platform-trial-hierarchy.md) · [platform-billing-lines.md](./platform-billing-lines.md)

## Context

Calendar post-paid full-month billing is simple but harsh on first enable. Pure day-proration invites toggle fraud. Store-style "7 days try, then period charge, one introductory offer" fits ERA calendar arrears without a rating engine.

## Decision

1. **Scope:** every billable `pricing_modules` key (SATELLITE gate, MODULE, ADDON) after the org leaves **platform** trial / paid mode.

2. **Lifetime one-shot** per `(organizationId, moduleKey)`: table `organization_module_graces` with `graceStartedAt`, `graceEndsAt`, `graceConsumedAt`, optional `scheduledEnableAt`.

3. **First ON** starts 7 Asia/Baku days; module usable; **not billable** while `now < graceEndsAt`.

4. **OFF during grace** yields no invoice line; **still consume** grace (no repeat free window).

5. **After grace** or **any later ON** is billable; full **calendar month** arrears (invoice 1st of M+1 for month M). `pendingDeactivation` applies only when billable.

6. **Late-month modal** when enabling would leave a short billable tail in the current month after grace (Baku day-of-month >= 20, or fewer than 7 calendar days remain after `graceEndsAt` in month M):
   **Start trial now** | **Defer to 1st next month** | **Cancel**.
   Defer sets `scheduledEnableAt` = first day next Baku month.

7. Org-level platform trial does **not** stack module grace; grace starts only in paid mode.

## Consequences

- Copy must say "calendar month (Asia/Baku)", never "30 days from enable".
- Invoice `ratingBasis=GRACE` lines are omitted or zero; `FULL_MONTH` after.
- No day-proration or decade buckets in this ADR.
