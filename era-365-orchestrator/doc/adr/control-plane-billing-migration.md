# ADR: Billing & platform services — Finance → Orchestrator

| Field | Value |
|-------|-------|
| Status | **Accepted** (architecture) · **CP-BILLING cutover ~80%** (2026-05-23) |
| Date | 2026-05-23 |
| Deciders | Product / platform team |

## Context

ERA Finance was the only product. Identity, subscription, billing, quotas, and WhatsApp invoice monetization were implemented inside **era-finance-core**. Industry **satellites** and **platform add-ons** require a single control plane.

Orchestrator already provides SSO, entitlements validation, satellite event ingress, and a **control-plane Prisma schema** (`TenantBilling`, `UsageMeterEvent`, `OrganizationModule`, …) mirroring Finance tables during migration.

## Decision

1. **era-365-orchestrator** is the **system of record** for:
   - commercial subscription (modules, bundles, platform add-ons),
   - post-paid platform invoicing,
   - tier/quota metering and `accumulatedBalance`,
   - platform add-on APIs (Notifications, Booking, Portal, …),
   - public pricing and Super-Admin pricing catalog (API).

2. **era-finance-core** remains the **accounting satellite**:
   - GL, sales/purchase documents, inventory, tax, counterparty MDM,
   - satellite event **consumer** for journal posting,
   - staff in-app notifications (ERP bell),
   - no long-term ownership of `/api/billing/*` or subscription snapshot.

3. **Billing rules** (unchanged product law):
   - **Trial:** 3 calendar months; then post-paid.
   - **Modules/satellites/add-ons:** charged on **1st of next month** for prior month usage.
   - **Metered quotas:** tier ceilings + unit prices; **`accumulatedBalance`** updates **during** the billing period when over included limits.

4. All apps (Finance web, satellites) fetch entitlement snapshot from **orchestrator**, not Finance DB directly.

## Consequences

### Positive

- One launcher and one invoice for the customer.
- Satellites stay thin; platform revenue scales without duplicating billing code.
- Notifications Pack naturally serves Finance + clinic + retail from one outbox.

### Negative / cost

- Migration period with dual APIs and proxy layers.
- Finance Super-Admin billing UI must be rewired or duplicated on orchestrator web.
- Careful cutover for monthly cron and payment webhooks.

## Migration map (Finance → Orchestrator)

| Component | Action |
|-----------|--------|
| `SubscriptionAccessService` / `GET /subscription/me` | **Done on CP** — Finance web via `/cp/v1/subscription/me`; Finance API controller removed |
| `BillingModule`, monthly invoice cron | **Done on CP** — removed from Finance `app.module` |
| `QuotaService`, `UsageMeterEvent` | **Done** — Finance `QuotaService` → `POST /internal/v1/quota/assert` |
| `PricingModule`, `PricingBundle`, `SystemConfig` billing keys | **Done on CP** — Super-Admin UI via `/cp/v1/admin/*` |
| Referrals / early-access | **Done on CP** — signup attach via `POST /internal/v1/referrals/attach-on-signup` |
| `organization_modules`, `tenant_billing` | Orchestrator DB authoritative; **pending CP-BILLING-5** — Finance signup still writes local subscription row |
| Finance `NotificationService` (in-app bell) | **Keep in Finance** |
| Sales invoice email send | Temporary; merge into Notifications Pack outbox |

## Non-goals (this ADR)

- Moving GL or sales invoice tables to orchestrator.
- Building full orchestrator web launcher in this phase (API first).
- Replacing `@era/contracts` satellite accounting events.

## Compliance

- Document status in [DELIVERY-ORCHESTRATOR.md](../DELIVERY-ORCHESTRATOR.md) phases **CP-BILLING**, **CP-PLATFORM**.
- Ecosystem overview: [docs/CONTROL_PLANE_ARCHITECTURE.md](../../../docs/CONTROL_PLANE_ARCHITECTURE.md).
- Platform add-on specs: [docs/PLATFORM_ADDONS.md](../../../docs/PLATFORM_ADDONS.md).

## References

- Orchestrator schema: `packages/database/prisma/schema.prisma` (`TenantBilling`, `UsageMeterEvent`)
- Finance PRD §7.12.5 (post-paid), §16 (tier meter)
- Existing CP entitlements: `apps/api/src/entitlements/entitlements.service.ts`
