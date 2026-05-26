# ERA ecosystem — readiness matrix

Living snapshot of **code + DELIVERY** readiness.

**Refresh:** Cursor skill `era-readiness-matrix` («обнови матрицу готовности») or `node scripts/delivery-readiness.mjs` for §1 counts only.

**Related:** [INTEGRATION_SSO_EVENTS.md](./INTEGRATION_SSO_EVENTS.md) · [MODULES_CATALOG.md](./MODULES_CATALOG.md) · [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) · [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md) · [LOCAL_UAT_GAP_CHECKLIST.md](./LOCAL_UAT_GAP_CHECKLIST.md) (launcher, auth, MDM, UI gaps for local UAT)

Last updated: 2026-05-26 (P01: `delivery-readiness.mjs` + `readiness-coverage.mjs`)

---

## Methodology

| Metric | Source |
|--------|--------|
| **% DELIVERY** | `[x]` / (`[x]` + `[ ]`) in each `era-*/doc/DELIVERY*.md` |
| **API level** | `Impl` · `Live` · `MVP` · `Stub` · `—` |
| **Event ingress** | `@era/contracts` → `isSatelliteEvent()` → Finance worker |

### Rules for §2.2 and §4

| Rule | Description |
|------|-------------|
| **11 apps** | Fin · Orch · Hot · FB · Ret · Log · Con · CRM · Auto · Cli · Who |
| **N/A** | Not applicable by architecture (not a gap) |
| **§2.2 host** | Implements `v1/billing/*` / hosts subscription API — **Orch only** |
| **§2.2 consumer** | Reads `GET /v1/subscription/me` or Finance `/cp` proxy |
| **§4 ≥ MVP** | App counts if code has a **calling** hook (not re-export only). Verify: `node scripts/readiness-coverage.mjs` |
| **§4 consumer %** | Denominator excludes **N/A** apps per family (Fin for booking/portal/loyalty/domains/delivery). Orch **H** = API host only |
| **§4 bridge** | Hotel↔FB measured as **2/2 roles** (provider + consumer), not 2/11 apps |

---

## 2. API × application matrix

Legend: **Impl** · **Live** · **MVP** · **Stub** · **—**

Columns: **Fin** · **Orch** · **Hot** · **FB** · **Ret** · **Log** · **Con** · **CRM** · **Auto** · **Cli** · **Who**

### 2.1 Control plane and identity

| API family | Fin | Orch | Hot | FB | Ret | Log | Con | CRM | Auto | Cli | Who |
|------------|-----|------|-----|-----|-----|-----|-----|-----|------|-----|-----|
| Auth login / refresh / SSO | Live | Live | Live | Live | Live | Live | Live | Live | Live | Live | Live |
| Memberships / switch-org | Live | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| RBAC join / access / transfer / disputes | Live | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Entitlements validate (server) | Live | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Platform session (`financeRole` + org via SSO) | N/A | N/A | Live | MVP | Live | Live | Live | Live | Live | Live | Live |
| Operational RBAC (local User/Role) | N/A | N/A | Live | Live | Live | Live | Live | Live | Live | Live | Live |
| MDM `internal/v1/mdm` | N/A | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

**N/A** on satellites for memberships / join / transfer = canonical API only on **Orch** + **Finance proxy** ([INTEGRATION_SSO_EVENTS.md](./INTEGRATION_SSO_EVENTS.md)). Satellites consume **platform session** (SSO) and **local ops roles** (waiter, FB_MANAGER, …).

### 2.2 Billing and commercial (post CP-BILLING)

Commercial API lives on **era-365-orchestrator**; Finance web proxies via `/cp/*` ([CP-BILLING-MIGRATION.md](./CP-BILLING-MIGRATION.md)). Satellites use **billing snapshot consumer** only.

#### 2.2.1 Subscription and entitlements

| API | Fin | Orch | Hot | FB | Ret | Log | Con | CRM | Auto | Cli | Who |
|-----|-----|------|-----|-----|-----|-----|-----|-----|------|-----|-----|
| `GET /v1/subscription/me` (consumer) | Live | Live | Live | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP |
| `POST /v1/subscription/select-plan`, module patch | Live | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| `internal/v1/entitlements/validate` | Live | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| `GET /api/platform/billing-snapshot` (satellite route) | — | — | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP |

#### 2.2.2 Owner billing (`v1/billing/*`)

| API group | Fin | Orch | Hot | FB | Ret | Log | Con | CRM | Auto | Cli | Who |
|-----------|-----|------|-----|-----|-----|-----|-----|-----|------|-----|-----|
| Summary, invoices, PDF | Live | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Marketplace, catalog, module-states, plans | Live | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Checkout, payment-orders, activate-premium | Live | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Referrals `v1/partner`, admin | — | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

#### 2.2.3 Public, webhooks, quota, early-access

| API | Fin | Orch | Hot | FB | Ret | Log | Con | CRM | Auto | Cli | Who |
|-----|-----|------|-----|-----|-----|-----|-----|-----|------|-----|-----|
| `GET /v1/public/pricing` | — | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| `POST /v1/billing/webhooks/*` | — | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| `internal/v1/quota` tier meter | Live | Impl | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| `v1/early-access` (+ admin) | — | Impl | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

### 2.3 Platform add-ons (`/platform/*`)

| API | Orch | Fin | Hot | FB | Ret | Log | Con | CRM | Auto | Cli | Who |
|-----|------|-----|-----|-----|-----|-----|-----|-----|------|-----|-----|
| **notifications** `v1/send` | Live | Live | Live | Live | Live | Live | Live | Live | Live | Live | Live |
| **booking** slots/appointments | Impl MVP | — | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP |
| **portal** magic links | Impl MVP | — | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP |
| **payments** payment-links | Impl MVP | Live | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP |
| **loyalty** | Impl MVP | — | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP |
| **domains** | Impl MVP | — | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP |
| **delivery** | Impl MVP | — | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP | MVP |

### 2.4 Event bus and Finance worker

| Type | Emitter | Finance handler | Level |
|------|---------|-----------------|-------|
| `SATELLITE_HOTEL_RESERVATION_COMPLETED` | hotel | `handleHotelReservation` | Live |
| `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` | hotel | `handleHotelNightAudit` | Live |
| `SATELLITE_HOTEL_INVOICE_ISSUED` | hotel | `handleHotelInvoiceIssued` | Live |
| `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT` | hotel | `handleHotelCityLedgerSnapshot` | Live |
| `SATELLITE_RETAIL_SALE_COMPLETED` | retail | `handleRetailSale` | Live |
| `SATELLITE_RETAIL_SHIFT_CLOSED` | retail | `handleRetailShiftClosed` | Live |
| `SATELLITE_LOGISTICS_TRIP_COMPLETED` | logistics | `handleLogisticsTrip` | Live |
| `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED` | construction | `handleConstructionAct` | Live |
| `SATELLITE_CRM_LEAD_CONVERTED` | crm | `handleCrmLead` | Live |
| `SATELLITE_CRM_VISIT_LOGGED` | crm | `handleCrmVisitLogged` | Live |
| `SATELLITE_AUTO_WORK_ORDER_COMPLETED` | auto-sto | `handleAutoSto` | Live |
| `SATELLITE_CLINIC_VISIT_COMPLETED` | clinic | `handleClinicVisit` | Live |
| `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` | clinic | `handleClinicLabOrder` | Live |
| `SATELLITE_WHOLESALE_ORDER_CONFIRMED` | wholesale | `handleWholesaleOrder` | Live |

Hotel **outbound-only** (not in `isSatelliteEvent`): `FOLIO_CHARGE_POSTED`, `FOLIO_PAYMENT_RECEIVED`, `FOLIO_CHARGE_VOIDED`, `MASTER_DATA_SYNC`, `PAYMENT_FISCALIZED` — [HOSPITALITY_FINANCE_BOUNDARY.md](./HOSPITALITY_FINANCE_BOUNDARY.md).

### 2.5 Vertical bridge APIs

| API | Provider | Consumer | Level |
|-----|----------|----------|-------|
| Hotel `/api/pms/*`, room-charge | hotel | fb-pos | Live |
| Clinic sanatorium episode bridge | clinic | hotel | Live |
| Wholesale credit limit | wholesale | Finance AR | Live |
| Finance deep links | finance | hotel UI | MVP |

---

## 3. Satellite × integration × level

| Satellite | SSO (CP) | Events → Fin | Platform notif | Platform booking | Portal / pay | Finance boundary | Other |
|-----------|----------|--------------|----------------|------------------|--------------|------------------|-------|
| finance-core | Live | Live (13) | Live | — | Live | SoT | Launcher |
| orchestrator | Impl | Impl | Live (B2) | MVP (B3) | MVP (B4–B8) | Billing SoT | MDM |
| hotel-pms | Live | Live | Live | MVP (spa) | MVP | Live | FB bridge, Wave F loyalty/domains/delivery |
| fb-pos | Live | Live | Live | MVP | MVP | Events | Hotel bridge, Wave F full §4 commerce |
| retail-pos | Live | Live | Live | MVP | MVP | Events | Wave F loyalty/domains/delivery |
| logistics | Live | Live | Live | MVP | MVP | Events | Wave F loyalty/domains |
| construction | Live | Live | Live | MVP | MVP | Events | Wave F loyalty/domains |
| crm-field | Live | Live | Live | MVP | MVP | MDM | Wave F loyalty/domains |
| auto-sto | Live | Live | Live | MVP | MVP | Events | Wave F delivery/loyalty/domains |
| clinic | Live | Live | Live | MVP | MVP | Events | Wave F delivery/loyalty/domains |
| wholesale | Live | Live | Live | MVP | MVP | MVP credit | Wave F loyalty/domains |

---

## 1. DELIVERY % by application

| Application | DELIVERY file | Done | Open | **%** |
|-------------|---------------|------|------|-------|
| era-hotel-pms | [DELIVERY.md](../era-hotel-pms/doc/DELIVERY.md) | 134 | 10 | 93% |
| era-fb-pos | [DELIVERY-FB.md](../era-fb-pos/doc/DELIVERY-FB.md) | 39 | 0 | 100% |
| era-retail-pos | [DELIVERY-RETAIL.md](../era-retail-pos/doc/DELIVERY-RETAIL.md) | 33 | 3 | 92% |
| era-clinic | [DELIVERY-CLINIC.md](../era-clinic/doc/DELIVERY-CLINIC.md) | 32 | 3 | 91% |
| era-construction | [DELIVERY-CONSTRUCTION.md](../era-construction/doc/DELIVERY-CONSTRUCTION.md) | 14 | 0 | 100% |
| era-auto-sto | [DELIVERY-AUTO.md](../era-auto-sto/doc/DELIVERY-AUTO.md) | 11 | 0 | 100% |
| era-wholesale | [DELIVERY-WHOLESALE.md](../era-wholesale/doc/DELIVERY-WHOLESALE.md) | 16 | 0 | 100% |
| era-crm-field | [DELIVERY-CRM.md](../era-crm-field/doc/DELIVERY-CRM.md) | 22 | 1 | 96% |
| era-logistics | [DELIVERY-LOGISTICS.md](../era-logistics/doc/DELIVERY-LOGISTICS.md) | 20 | 0 | 100% |
| era-365-orchestrator | [DELIVERY-ORCHESTRATOR.md](../era-365-orchestrator/doc/DELIVERY-ORCHESTRATOR.md) | 28 | 2 | 93% |
| era-finance-core | [DELIVERY-FINANCE.md](../era-finance-core/doc/DELIVERY-FINANCE.md) | 9 | 1 | 90% |

**Aggregate (11 DELIVERY files):** 358/378 (**95%**). Regenerate: `node scripts/delivery-readiness.mjs`.

---

## 4. Cross-app API coverage (%)

Regenerate: `node scripts/readiness-coverage.mjs` (full table) or `node scripts/readiness-coverage.mjs --consumer-only` (consumer % only).

**Legend (§4.2):** ✓ = consumer hook; **H** = Orch API host only; **N/A** = not applicable (excluded from consumer %); — = gap.

### 4.1 Summary (consumer vs all apps)

| API family | Consumer apps | Consumer % | All apps (incl. host) |
|------------|---------------|------------|-------------------------|
| Billing snapshot consumer | 11/11 | 100% | 11/11 (100%) |
| Billing API host | 1/1 | 100% | 1/11 (9%, Orch only) |
| Platform notifications | 10/11 | 91% | 11/11 (100%) |
| Platform booking | 9/10 | 90% | 10/11 (91%) |
| Platform portal | 9/10 | 90% | 10/11 (91%) |
| Platform payments | 11/11 | 100% | 11/11 (100%) |
| Platform loyalty | 10/10 | 100% | 10/11 (91%) |
| Platform domains | 10/10 | 100% | 10/11 (91%) |
| Platform delivery | 10/10 | 100% | 10/11 (91%) |
| Hotel↔FB bridge **(roles)** | 2/2 | **100%** | Hot provider + FB consumer ([pms-bridge](era-fb-pos/src/lib/pms-bridge-client.ts)) |

**N/A by design (consumer):** Fin — booking, portal, loyalty, domains, delivery; all apps except Orch — billing host.

**Wave F (2026-05-23):** delivery on Hot/FB/Auto/Cli; `createPromotion` + `createCustomDomain` on 9 commerce satellites; script host detection for Orch booking/portal.

### 4.2 App × family checklist

| App | Bill.snap | Bill.host | Notif | Book | Portal | Pay | Loy | Dom | Del |
|-----|-----------|-----------|-------|------|--------|-----|-----|-----|-----|
| era-finance-core | ✓ | N/A | ✓ | N/A | N/A | ✓ | N/A | N/A | N/A |
| era-365-orchestrator | ✓ | ✓ | H | H | H | ✓ | ✓ | ✓ | ✓ |
| era-hotel-pms | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-fb-pos | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-retail-pos | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-logistics | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-construction | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-crm-field | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-auto-sto | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-clinic | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-wholesale | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 5. How to use

| Question | Where |
|----------|-------|
| Refresh this doc | Skill `era-readiness-matrix` or agent steps in [.cursor/skills/era-readiness-matrix/SKILL.md](../.cursor/skills/era-readiness-matrix/SKILL.md) |
| §1 counts only | `node scripts/delivery-readiness.mjs` |
| §4 coverage | `node scripts/readiness-coverage.mjs` |
| Contracts | [INTEGRATION_SSO_EVENTS.md](./INTEGRATION_SSO_EVENTS.md) |
| Manual verification | Per-app `UAT-SMOKE.md`, [SMOKE_ALL_SERVICES.md](./SMOKE_ALL_SERVICES.md), [UAT-SMOKE-PLATFORM.md](../era-365-orchestrator/doc/UAT-SMOKE-PLATFORM.md) |
