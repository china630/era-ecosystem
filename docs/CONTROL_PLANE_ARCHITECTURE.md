# Control plane architecture (ERA 365 Orchestrator)

**Status:** CP-BILLING cutover in progress (2026-05). Billing API, referrals, early-access, and Super-Admin pricing run on **orchestrator**; Finance web routes billing calls via `/cp/v1/*`; Finance API `QuotaService` delegates to `POST /internal/v1/quota/assert`. ERP signup still creates local `organization_subscriptions` row until CP-BILLING-5.

## Why reorganize

ERA started as **Finance-only** — identity, subscription, billing, and entitlements were colocated with the ERP. With **industry satellites** (hotel, fb-pos, retail, clinic, …) and **platform services**, shared capabilities must live in one **control plane**:

| Era | Entry point | Shared services |
|-----|-------------|-----------------|
| v1 | Finance core only | Inside Finance API/DB |
| v2 (target) | **Orchestrator** (launcher + SSO) | Orchestrator API/DB; Finance = accounting satellite |

**Rule:** anything **cross-tenant, cross-satellite, or commercial** (billing, entitlements, platform add-ons, public pricing) → **orchestrator**. Finance keeps **ledger, documents, inventory, tax, and GL dispatch** for accounting events.

See also: [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md), [era-365-orchestrator/doc/adr/control-plane-billing-migration.md](../era-365-orchestrator/doc/adr/control-plane-billing-migration.md).

---

## System diagram

```text
                    ┌─────────────────────────────┐
                    │   era-365-orchestrator      │
                    │   (control plane :4100)     │
                    ├─────────────────────────────┤
                    │ Identity · SSO · RBAC       │
                    │ Billing · entitlements      │
                    │ Platform add-ons API        │
                    │ Satellite event ingress     │
                    │ MDM Phase 1 · launcher web  │
                    └───────────┬─────────────────┘
          SSO / JWT             │              events
    ┌───────────┬───────────────┼───────────────┬──────────────┐
    ▼           ▼               ▼               ▼              ▼
 Finance     hotel-pms       retail-pos      clinic        … satellites
 (ERP)       (ops)           (ops)           (ops)
    │                           │
    └──── GL / invoices / stock ┘  ← accounting source of truth stays in Finance
```

---

## Post-paid billing model (product law)

Two **independent** money flows per organization (VÖEN):

### 1. Subscription — modules & satellites (calendar billing)

| Aspect | Rule |
|--------|------|
| **Trial** | 3 calendar months from signup (`trialExpiresAt`, Asia/Baku) |
| **During trial** | Base ERP + trial bundle modules; **no** monthly platform invoice for modules |
| **After trial** | **Post-paid:** usage in month **M** → platform invoice on **1st of M+1** for full month M |
| **What is billed** | ERA Core (Foundation) + active `organization_modules` (ERP modules, `industry_*` satellites, platform add-ons) + bundle discounts |
| **Deactivation** | Module stays active until end of calendar month (`pendingDeactivation`) |

### 2. Metered quotas — tier spend ceiling (real-time accumulation)

| Aspect | Rule |
|--------|------|
| **Tier** | `TIER_0` … `TIER_3` sets **included quota ceilings** (users, invoices/month, storage, WhatsApp alerts, OCR, …) |
| **Overlimit** | When usage exceeds tier included amount, **meter unit price** applies (`billing.meter_unit_pricing_v1`) |
| **Accumulation** | Charges accrue to `accumulatedBalance` in current `billingPeriodKey` (Baku month) |
| **Tier ceiling** | Each tier has a **max accumulated spend** cap for the period; hitting cap triggers tier upgrade path / block policy (see Finance PRD §16) |
| **When charged** | Metered overlimit is **not** deferred to “feel free until month end” for tier cap — accumulation is **continuous** within the billing period |

**Summary:** *“Pay for modules next month”* vs *“Metered quota over tier fills the spend bucket now”* — both post-paid at invoice time, but **quota metering is live**, subscription modules are **monthly arrears**.

Timezone for billing period: **Asia/Baku** unless noted otherwise in TZ.

---

## What moves to orchestrator

### Control plane (orchestrator owns)

| Domain | Current location | Target |
|--------|------------------|--------|
| Login, refresh, SSO exchange | Split Finance / Orchestrator | **Orchestrator** (Finance proxies optional during migration) |
| Memberships, org switch, OWNER | Orchestrator CP1 | **Orchestrator** |
| `GET /subscription/me` snapshot | Finance API | **Orchestrator** (satellites + Finance web consume) |
| Module / bundle activation | Finance `billing/*` | **Orchestrator** |
| Platform monthly invoice generation | Finance cron | **Orchestrator** |
| `billingStatus` SOFT/HARD block | Finance + CP `TenantBilling` | **Orchestrator** (enforce via entitlements validate) |
| Pricing catalog (Foundation, modules, bundles) | Finance Super-Admin | **Orchestrator** admin API; Finance web may proxy UI temporarily |
| Public pricing `GET /public/pricing` | Finance | **Orchestrator** |
| Usage meter events | Finance `UsageMeterEvent` | **Orchestrator** (`usage_meter_events` in CP schema) |
| Early access waitlist (optional) | Finance | **Orchestrator** marketing plane |
| **Platform add-ons** | Partially Finance (WhatsApp quotas) | **Orchestrator** — see [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md) |
| Satellite event **ingress** | Orchestrator | **Stays orchestrator** |
| MDM Phase 1 | Orchestrator | **Stays orchestrator** |

### Finance core keeps (accounting satellite)

| Domain | Reason |
|--------|--------|
| Chart of accounts, journal, NAS | ERP core |
| Sales / purchase invoices, inventory | Operational accounting |
| Counterparty MDM, reconciliation | ERP CRM |
| Tax, compliance, banking | Regulated finance |
| **Satellite GL worker** | Consumes events → posts journals (accounting side-effect) |
| In-app **staff** notifications | ERP UX (not customer Notifications Pack) |
| Sales invoice **email** send | Document delivery from ERP context until unified outbox migrates |

---

## Entitlements & gating

**Source of truth:** orchestrator reads `organization_modules`, `organization_subscriptions`, `tenant_billing`, platform add-on flags.

**Flow:**

1. User opens any app → SSO via orchestrator → JWT with `organizationId`, `roles`, `isOwner`.
2. App calls orchestrator **`validate-entitlement`** (or embeds claims refreshed from CP) before mutating data.
3. Satellite checks module slug e.g. `industry_clinic`, `platform_notifications_pro`.
4. Finance checks ERP modules e.g. `manufacturing`, `tax_pro` — same CP snapshot, not a second subscription DB.

**Launcher (future):** orchestrator web lists entitled apps (Finance, Hotel, Clinic, …) from one snapshot.

---

## Database strategy

Orchestrator CP schema (`era-365-orchestrator/packages/database`) already mirrors billing tables during migration (`tenant_billing`, `organization_modules`, `usage_meter_events`, …) with comment *“Shares PostgreSQL with era-finance-core during migration”*.

**Phases:**

1. **Dual-write / read fallback** — CP and Finance both visible; orchestrator entitlements service already falls back to `organizations.billing_status`.
2. **Cutover** — registration and module toggles only on CP APIs.
3. **Finance slimming** — remove duplicate billing modules from Finance API; Finance web calls orchestrator for `/settings/subscription`.

---

## API surface (target)

| Prefix | Owner | Consumers |
|--------|-------|-----------|
| `/auth/*`, `/memberships/*` | Orchestrator | All apps |
| `/billing/*`, `/subscription/*` | Orchestrator | Finance web, launcher, Owner settings |
| `/platform/notifications/*` | Orchestrator | Finance, all satellites |
| `/platform/booking/*` | Orchestrator | Clinic, auto-sto, retail, hotel spa |
| `/platform/portal/*` | Orchestrator | All customer-facing portals |
| `/internal/v1/satellite-events` | Orchestrator | Satellites |
| `/api/*` accounting | Finance | Finance web only (+ auditor SSO) |

Contracts package: extend **`@era/contracts`** with platform event types and entitlement slugs.

---

## Migration principles

1. **No big-bang** — proxy from Finance to orchestrator until parity tests pass.
2. **Owner billing UI** may stay on Finance domain first; backend moves underneath.
3. **Satellites never talk to Finance for subscription** — only orchestrator (already true for SSO).
4. Document every moved endpoint in ADR changelog.

---

## Related docs

- [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md)
- [MODULES_CATALOG.md](./MODULES_CATALOG.md)
- [HOSPITALITY_FINANCE_BOUNDARY.md](./HOSPITALITY_FINANCE_BOUNDARY.md)
- [era-365-orchestrator/doc/DELIVERY-ORCHESTRATOR.md](../era-365-orchestrator/doc/DELIVERY-ORCHESTRATOR.md)
- Finance [PRD.md](../era-finance-core/PRD.md) §7, §16 (billing detail until fully migrated)
