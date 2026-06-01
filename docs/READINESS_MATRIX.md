# ERA ecosystem — readiness matrix

Living snapshot of **code + DELIVERY** readiness.

**Refresh:** Cursor skill `era-readiness-matrix` («обнови матрицу готовности») or `node scripts/delivery-readiness.mjs` for §1 counts only.

**Related:** [INTEGRATION_SSO_EVENTS.md](./INTEGRATION_SSO_EVENTS.md) · [MODULES_CATALOG.md](./MODULES_CATALOG.md) · [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) · [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md) · [LOCAL_UAT_GAP_CHECKLIST.md](./LOCAL_UAT_GAP_CHECKLIST.md) (launcher, auth, MDM, UI gaps for local UAT)

Last updated: 2026-06-01 (era-hotel-pms Wave B ElectraWeb FO parity · DELIVERY see era-hotel-pms/doc/DELIVERY.md § Wave B)

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
| Platform session (`financeRole` + org via SSO) | N/A | N/A | Live | Live | Live | Live | Live | Live | Live | Live | Live |
| Operational RBAC (local User/Role) | N/A | N/A | Live | Live | Live | Live | Live | Live | Live | Live | Live |
| MDM `internal/v1/mdm` | N/A | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

**N/A** on satellites for memberships / join / transfer = canonical API only on **Orch** + **Finance proxy** ([INTEGRATION_SSO_EVENTS.md](./INTEGRATION_SSO_EVENTS.md)). Satellites consume **platform session** (SSO) and **local ops roles** (waiter, FB_MANAGER, …).

### 2.2 Billing and commercial (post CP-BILLING)

Commercial API lives on **era-orchestrator**; Finance web proxies via `/cp/*` ([CP-BILLING-MIGRATION.md](./CP-BILLING-MIGRATION.md)). Satellites use **billing snapshot consumer** only.

#### 2.2.1 Subscription and entitlements

| API | Fin | Orch | Hot | FB | Ret | Log | Con | CRM | Auto | Cli | Who |
|-----|-----|------|-----|-----|-----|-----|-----|-----|------|-----|-----|
| `GET /v1/subscription/me` (consumer) | Live | Live | Live | Live | Live | Live | Live | Live | Live | Live | Live |
| `POST /v1/subscription/select-plan`, module patch | Live | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| `internal/v1/entitlements/validate` | Live | Live | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| `GET /api/platform/billing-snapshot` (satellite route) | — | — | Live | Live | Live | Live | Live | Live | Live | Live | Live |

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
| **booking** slots/appointments | Live | — | Live | Live | Live | Live | Live | Live | Live | Live | Live |
| **portal** magic links | Live | — | Live | Live | Live | Live | Live | Live | Live | Live | Live |
| **payments** payment-links | Live | Live | Live | Live | Live | Live | Live | Live | Live | Live | Live |
| **loyalty** | Live | — | Live | Live | Live | Live | Live | Live | Live | Live | Live |
| **domains** | Live | — | Live | Live | Live | Live | Live | Live | Live | Live | Live |
| **delivery** | Live | — | Live | Live | Live | Live | Live | Live | Live | Live | Live |

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
| orchestrator | Live | Impl | Live (B2) | Live (B3–B8) | Live | Billing SoT | MDM cutover |
| hotel-pms | Live | Live | Live | Live (spa) | Live | Live | FB bridge; full §4 hooks (pre-GA) |
| fb-pos | Live | Live | Live | Live | Live | Events | Hotel bridge; full §4 hooks (pre-GA) |
| retail-pos | Live | Live | Live | Live | Live | Events | v2.0 fiscal/offline/marketplace; full §4 hooks |
| logistics | Live | Live | Live | Live | Live | Events | Full §4 hooks |
| construction | Live | Live | Live | Live | Live | Events | Full §4 hooks |
| crm-field | Live | Live | Live | Live | Live | MDM | v2.0 WhatsApp live; full §4 hooks |
| auto-sto | Live | Live | Live | Live | Live | Events | v2.0 tool crib; full §4 hooks |
| clinic | Live | Live | Live | Live | Live | Events | v2.0 `/portal`; full §4 hooks |
| wholesale | Live | Live | Live | Live | Live | Live | Full §4 hooks |

---

## 1. DELIVERY % by application

| Application | DELIVERY file | Done | Open | **%** |
|-------------|---------------|------|------|-------|
| era-hotel-pms | [DELIVERY.md](../era-hotel-pms/doc/DELIVERY.md) | 146 | 0 | 100% |
| era-fnb-pos | [DELIVERY-FB.md](../era-fnb-pos/doc/DELIVERY-FB.md) | 43 | 0 | 100% |
| era-retail-pos | [DELIVERY-RETAIL.md](../era-retail-pos/doc/DELIVERY-RETAIL.md) | 45 | 0 | 100% |
| era-clinic | [DELIVERY-CLINIC.md](../era-clinic/doc/DELIVERY-CLINIC.md) | 43 | 0 | 100% |
| era-construction | [DELIVERY-CONSTRUCTION.md](../era-construction/doc/DELIVERY-CONSTRUCTION.md) | 21 | 0 | 100% |
| era-auto-service | [DELIVERY-AUTO.md](../era-auto-service/doc/DELIVERY-AUTO.md) | 22 | 0 | 100% |
| era-wholesale | [DELIVERY-WHOLESALE.md](../era-wholesale/doc/DELIVERY-WHOLESALE.md) | 19 | 0 | 100% |
| era-crm | [DELIVERY-CRM.md](../era-crm/doc/DELIVERY-CRM.md) | 27 | 0 | 100% |
| era-logistics | [DELIVERY-LOGISTICS.md](../era-logistics/doc/DELIVERY-LOGISTICS.md) | 29 | 0 | 100% |
| era-orchestrator | [DELIVERY-ORCHESTRATOR.md](../era-orchestrator/doc/DELIVERY-ORCHESTRATOR.md) | 31 | 0 | 100% |
| era-finance-core | [DELIVERY-FINANCE.md](../era-finance-core/doc/DELIVERY-FINANCE.md) | 10 | 0 | 100% |

**Aggregate (11 DELIVERY files):** 436/436 (**100%**). Regenerate: `node scripts/delivery-readiness.mjs`.

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
| Hotel↔FB bridge **(roles)** | 2/2 | **100%** | Hot provider + FB consumer ([pms-bridge](../era-fnb-pos/src/lib/pms-bridge-client.ts)) |

**N/A by design (consumer):** Fin — booking, portal, loyalty, domains, delivery; all apps except Orch — billing host.

**Coverage notes (2026-05-27):** Consumer booking/portal **9/10 (90%)** = all **9 satellites** ✓; **Orch** is API **host** (`H`), excluded from consumer numerator (not a gap). Notifications **10/11** = **Fin** is dispatch **host** (`H`) only. All satellites use `runPlatformCommerceHooks` / direct CP-B3–B8 callers. MDM register: Orch when `ERA_MDM_REGISTRATION_CUTOVER=true`.

**i18n (2026-05-27):** All web nodes — contract `az|ru|en`, default `az`, cookie `era_i18n_lang`; Finance `i18n:audit` OK. Not a §4 integration metric — see [SATELLITE_DOCUMENTATION § i18n](./SATELLITE_DOCUMENTATION.md#i18n-stacks-ecosystem-contract).

### 4.2 App × family checklist

| App | Bill.snap | Bill.host | Notif | Book | Portal | Pay | Loy | Dom | Del |
|-----|-----------|-----------|-------|------|--------|-----|-----|-----|-----|
| era-finance-core | ✓ | N/A | H | N/A | N/A | ✓ | N/A | N/A | N/A |
| era-orchestrator | ✓ | ✓ | ✓ | H | H | ✓ | ✓ | ✓ | ✓ |
| era-hotel-pms | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-fnb-pos | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-retail-pos | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-logistics | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-construction | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-crm | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-auto-service | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-clinic | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| era-wholesale | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### 4.3 Integration MVP — explicit gaps

**None** on pay/commerce paths after 2026-05-26 regen. Residual product MVP (not §4 integration):

| Gap | Owner | Note |
|-----|-------|------|
| FB table booking on pay | era-fnb-pos | Optional `createBookingSlot` on reservation — not required for folio/room-charge hooks |
| Finance tier Manufacturing / IFRS | era-finance-core | Tier 2+/3 module UAT — not integration matrix |
| Satellite `subscription/me` depth | per-app | Consumer **Live** via billing-snapshot proxy; deep plan UI remains Orch-only |

---

## 5. How to use

| Question | Where |
|----------|-------|
| Refresh this doc | Skill `era-readiness-matrix` or agent steps in [.cursor/skills/era-readiness-matrix/SKILL.md](../.cursor/skills/era-readiness-matrix/SKILL.md) |
| §1 counts only | `node scripts/delivery-readiness.mjs` |
| §4 coverage | `node scripts/readiness-coverage.mjs` |
| Contracts | [INTEGRATION_SSO_EVENTS.md](./INTEGRATION_SSO_EVENTS.md) |
| Manual verification | Per-app `UAT-SMOKE.md`, [SMOKE_ALL_SERVICES.md](./SMOKE_ALL_SERVICES.md), [UAT-SMOKE-PLATFORM.md](../era-orchestrator/doc/UAT-SMOKE-PLATFORM.md) |

---

## 6. Open testing gate (2026-05-27)

**DELIVERY 100% ≠ production-ready.** Use this table before inviting external testers (Nafta, partners).

| Gate | Status | Evidence / action |
|------|--------|-----------------|
| **Closed / local UAT** (engineering) | **Go** | P0–P7 + SP7 done — [LOCAL_UAT_GAP_CHECKLIST.md](./LOCAL_UAT_GAP_CHECKLIST.md); stack [SETUP_AND_RUN.md](./SETUP_AND_RUN.md) |
| **Quartet smoke** (Orch · Fin · Hot · FB) | **Go** | [QUARTET_UAT.md](./QUARTET_UAT.md), `node scripts/quartet-smoke.mjs`, POS bridge |
| **Platform smoke** (billing, addons, RBAC) | **Go** | [UAT-SMOKE-PLATFORM.md](../era-orchestrator/doc/UAT-SMOKE-PLATFORM.md) |
| **All satellites health + SSO** | **Go** | [SMOKE_ALL_SERVICES.md](./SMOKE_ALL_SERVICES.md) § HTTP health + locale smoke |
| **Integration matrix §4** | **Go** | Pay 11/11; loyalty/domains/delivery 10/10 satellites; booking/portal 9/9 satellites (Orch = host) |
| **Finance i18n audit** | **Go** | `npm run i18n:audit` in `era-finance-core` |
| **Ecosystem i18n shell** | **Go** | Login/home/help + feature pages on industry apps; ERP full az/ru; EN via fallback |
| **Staging / prod deploy** | **Before external** | Backups, migrations, env legal URLs, `ERA_*` secrets — Finance [PRE-RELEASE-CHECKLIST](../era-finance-core/docs/deploy/PRE-RELEASE-CHECKLIST.md) |
| **Nafta on-site sign-off** | **Before GA** | [13-nafta-validation-checklist.md](../era-hotel-pms/doc/clone-spec/13-nafta-validation-checklist.md), multi-VÖEN org model |
| **Product polish** | **Non-blocking** | UI modals audit (P06 partial), MDM on satellites, Manufacturing/IFRS tier 2+ |

**Verdict:** **Можно идти на открытые (закрытые) тесты** для команды Nafta / внутренних пилотов на **localhost/staging** по чеклистам §8 [LOCAL_UAT](./LOCAL_UAT_GAP_CHECKLIST.md) и [QUARTET_UAT](./QUARTET_UAT.md). **Публичный GA** — после staging deploy, smoke green, и фиксации открытых вопросов D3 / multi-VÖEN (см. Nafta docs).

### What to do next (priority)

1. **Staging compose** — один `.env`, миграции всех БД, прогон `SMOKE_ALL_SERVICES` + locale smoke end-to-end.
2. **Nafta pilot script** — Orch → Hotel+FB SSO → night audit → room-charge → Finance GL handoff; clinic sanatorium episode по `reservationId`.
3. **Optional product** — FB table booking via `createBookingSlot` on pay (§4.3); не блокер UAT.
4. **UI program** (не блокер тестов) — admin modals, FB floor polish, Hotel FAQ block.
5. **Manufacturing / IFRS** — только если пилот требует tier 2+ Finance modules.
