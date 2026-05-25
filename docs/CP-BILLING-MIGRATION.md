# CP-BILLING — единый план переноса в orchestrator

**Цель:** за один программный инкремент перенести **весь** коммерческий control plane из **era-finance-core** в **era-365-orchestrator**. Без поэтапного «половина billing здесь, половина там» в steady state.

**Не входит в этот план:** Platform add-ons (Notifications Pack, Booking, …) — отдельная работа **после** CP-BILLING. См. [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md).

**Связанные документы:** [CONTROL_PLANE_ARCHITECTURE.md](./CONTROL_PLANE_ARCHITECTURE.md) · [ADR control-plane-billing-migration](../era-365-orchestrator/doc/adr/control-plane-billing-migration.md)

---

## Продуктовые правила (не меняем при переносе)

| Поток | Правило |
|-------|---------|
| **Trial** | 3 календарных месяца с signup (Asia/Baku) |
| **Модули / сателлиты / add-ons** | Post-paid: использование в месяце **M** → платформенный счёт **1-го числа M+1** |
| **Metered квоты** | Tier задаёт included + spend ceiling; overlimit → unit price → `accumulatedBalance` **в текущем периоде** |
| **Deactivation** | `pendingDeactivation` до конца календарного месяца |
| **Blocks** | `SOFT_BLOCK` / `HARD_BLOCK` через orchestrator entitlements |

---

## Что переносим (полный список)

### A. API — subscription & billing (Owner / authenticated)

Источник сегодня: `era-finance-core/apps/api/src/subscription/*`, `billing/*`.

| Endpoint (Finance) | Назначение | Orchestrator target |
|--------------------|------------|---------------------|
| `GET /api/subscription/me` | Снимок tier, modules, quotas, trial | `GET /v1/subscription/me` |
| `POST /api/subscription/select-plan` | Выбор tier / plan | `POST /v1/subscription/select-plan` |
| `PATCH /api/subscription/modules` | Legacy module patch | Deprecate или proxy → toggle-module |
| `GET /api/billing/summary` | Оценка суммы для Owner | `GET /v1/billing/summary` |
| `GET /api/billing/invoices` | Платформенные счета владельца | `GET /v1/billing/invoices` |
| `GET /api/billing/invoices/:id/pdf` | PDF platform invoice | `GET /v1/billing/invoices/:id/pdf` |
| `GET /api/billing/marketplace` | Каталог для Owner UI | `GET /v1/billing/marketplace` |
| `GET /api/billing/catalog` | Modules + bundles | `GET /v1/billing/catalog` |
| `GET /api/billing/module-states` | Active / pending off | `GET /v1/billing/module-states` |
| `GET /api/billing/plans` | Tier plans | `GET /v1/billing/plans` |
| `GET /api/billing/upgrade-preview` | Preview tier upgrade | `GET /v1/billing/upgrade-preview` |
| `POST /api/billing/toggle-module` | Вкл/выкл module | `POST /v1/billing/toggle-module` |
| `POST /api/billing/toggle-bundle` | Вкл/выкл bundle | `POST /v1/billing/toggle-bundle` |
| `POST /api/billing/activate-premium` | Premium unlock | `POST /v1/billing/activate-premium` |
| `POST /api/billing/checkout` | Payment checkout | `POST /v1/billing/checkout` |
| `POST /api/billing/tier-ceiling-unlock` | Tier spend unlock | `POST /v1/billing/tier-ceiling-unlock` |
| `GET /api/billing/payment-orders` | История оплат | `GET /v1/billing/payment-orders` |
| `GET /api/billing/orders/:id` | Payment order detail | `GET /v1/billing/orders/:id` |

### B. API — public & webhooks

| Endpoint (Finance) | Orchestrator target |
|--------------------|---------------------|
| `GET /api/public/pricing` | `GET /v1/public/pricing` |
| Billing webhooks (Pasha / provider) | `POST /v1/billing/webhooks/*` |
| Public billing routes in `billing-public.controller` | Same paths under orchestrator |

### C. API — Super-Admin (pricing config)

Источник: `era-finance-core/apps/api/src/admin/admin.controller.ts` (billing section).

| Группа | Перенос |
|--------|---------|
| `GET/PATCH config/billing/*` | Orchestrator `admin/billing/*` |
| `pricing-modules`, `pricing-bundles` CRUD | Orchestrator admin |
| `seed-pricing`, meter-unit-pricing, tier-spend-ceilings | Orchestrator admin |

Super-Admin **UI** может временно остаться на Finance web, но **backend only orchestrator**.

### D. Services & workers (перенос кода)

| Finance module / service | Действие |
|--------------------------|----------|
| `BillingService`, `BillingPlatformService` | → orchestrator `BillingModule` |
| `BillingMonthlyService` + queue/worker | → orchestrator cron/BullMQ |
| `BillingMeterService` | → orchestrator (tier spend + unit prices) |
| `BillingToggleService`, `BillingBundleToggleService` | → orchestrator |
| `BillingSettlementService` | → orchestrator |
| `BillingPaymentOrdersService` + providers | → orchestrator |
| `BillingPremiumActivationService` | → orchestrator |
| `BillingNotificationService` (email Owner о счёте) | → orchestrator |
| `BillingEntitlementService` | Merge into entitlements + subscription read model |
| `SubscriptionAccessService` | → orchestrator `SubscriptionService` |
| `QuotaService` + `QuotaGuard` | → orchestrator; Finance/satellites **call CP** |
| `OrganizationModuleService`, `OrganizationBundleService` | → orchestrator |
| `PricingService` (admin) | → orchestrator |
| `tariff-limits.ts`, `tier-spend-ceiling.ts`, `baku-billing.util.ts` | Shared package or orchestrator copy |
| `SubscriptionGuard`, `SubscriptionReadOnlyGuard` | Finance keeps thin wrapper → CP validate OR JWT claims from CP |

### E. Database (authoritative = orchestrator CP schema)

Уже есть в `era-365-orchestrator/packages/database/prisma/schema.prisma`:

- `tenant_billing`
- `organization_subscriptions`
- `organization_modules` / `organization_bundles`
- `subscription_invoices` / `billing_invoice_items`
- `usage_meter_events`
- `pricing`, `pricing_modules`, `pricing_bundles`
- `payment_orders`
- `system_config` (billing keys)

**Cutover:** orchestrator DB = SoT; Finance перестаёт писать в эти таблицы (shared PG migration period допустим, но один writer).

### F. Finance web — прокси (переходный минимум)

| UI | Изменение |
|----|-----------|
| `/settings/subscription` | `apiFetch` → orchestrator URL |
| `/super-admin/billing/*` | Admin API → orchestrator |
| `/pricing` (public) | `GET /v1/public/pricing` |
| `subscription-context.tsx` | Snapshot с orchestrator |

**Реализация (2026-05):** `era-finance-core/apps/web/lib/api-client.ts` — `resolveApiUrl()` автоматически маршрутизирует `/api/subscription|billing|partner|early-access|admin/config/billing|…` на orchestrator. В браузере — rewrite `/cp/v1/*` → `NEXT_PUBLIC_CONTROL_PLANE_URL` (см. `next.config.ts`). ERP auth и остальной `/api/*` по-прежнему на Finance API :4000.

### G. Satellites & orchestrator entitlements

| Компонент | Изменение |
|-----------|-----------|
| `EntitlementsService.validate` | Уже в CP — расширить module slug checks |
| SSO JWT | Optional: embed `activeModules[]` refresh from CP |
| Satellites | `GET subscription/me` только через orchestrator (не Finance) |

### H. Early access / painted door (in scope)

| Finance | Orchestrator target |
|---------|---------------------|
| `early-access/*` (waitlist) | `v1/early-access/*`, `v1/admin/early-access/*` |

### I. Referral & Partner program (in scope)

Источник: `era-finance-core/apps/api/src/referrals/*`, attach в `auth.service`, accrual в `billing-monthly.service`.

| Компонент | Finance | Orchestrator target |
|-----------|---------|---------------------|
| Core service | `referrals.service.ts` | `ReferralsModule` / `ReferralsService` |
| Partner dashboard | `GET /api/partner/*` | `GET /v1/partner/dashboard`, `qr.png` |
| Super-Admin CRUD | `GET\|POST\|PATCH /api/admin/referrals/*` | `GET\|POST\|PATCH /v1/admin/referrals/*` |
| Monthly expiry job | `referral-monthly` BullMQ (`0 5 1 * *` UTC) | Same on orchestrator |
| Signup attach | `attachReferralOnSignupTx` in Finance auth | Orchestrator org registration |
| Commission accrual | `accrueCommissionsForSubscriptionInvoice` | From orchestrator `BillingMonthlyService` |

**UI:** Finance `/partner` → orchestrator API (interim). Super-Admin referrals → CP admin API.

**Spec:** Finance TZ §14.9 (SoT after cutover — orchestrator PRD M10).

---

## Что НЕ переносим (остаётся в Finance)

| Комponent | Причина |
|-----------|---------|
| Sales / purchase **invoices** (`invoices` table) | ERP документы клиента |
| GL, NAS, inventory, tax | Accounting |
| `SatelliteEventDispatchService` / GL worker | Accounting side-effect |
| In-app **NotificationService** (bell) | Staff UX в ERP |
| `sendInvoiceEmail` на sales invoice | Документ ERP; позже optional bridge to Notifications Pack |
| Counterparty MDM | ERP |
| Referral commission **logic** tied to platform invoice | **Переносим** вместе с platform invoice generation |

---

## Порядок выполнения (один релиз, внутренние шаги)

```text
1. Orchestrator: поднять BillingModule (parity services + controllers)
2. Shared: @era/contracts или @era365/billing-contracts — DTO snapshot
3. Dual-write OFF: только orchestrator пишет billing tables
4. Finance API: thin proxy 307/forward на orchestrator (1 release) ИЛИ сразу switch web URLs
5. Workers: monthly invoice cron на orchestrator
6. Quota: все assert* в Finance → HTTP internal call CP
7. Tests: parity suite (subscription/me, toggle-module, monthly job dry-run)
8. Finance: удалить billing.module imports из app.module (dead code)
9. Docs: PRD Finance §7 — «billing moved to orchestrator PRD»
```

**Критерий готовности CP-BILLING:** ни один satellite и ни один billing UI endpoint не зависит от Finance DB/API для subscription state.

---

## Риски

| Риск | Mitigation |
|------|------------|
| Два writer на billing tables | Feature flag single writer |
| Payment webhooks URL | Update provider callback to orchestrator |
| Owner checkout downtime | Proxy week with forward |
| Quota regression | Contract tests on WA/OCR/invoice meter |

---

## Что такое «CP-B2 Notifications» (не путать с CP-BILLING)

**CP-B2** — это **следующий** проект после CP-BILLING: первый **Platform add-on** (WhatsApp/email/SMS outbox) как API на orchestrator. Он **не часть** переноса billing, но **использует** уже перенесённые квоты (`whatsappAlertsUsed`, meter).

Сейчас квоты WhatsApp живут в Finance; после CP-BILLING они живут в CP; CP-B2 добавляет **отправку сообщений**, а не перенос счетов.

---

## «Порядок vertical growth» — что это было

Это **не технический этап**, а продуктовый вопрос «кому первому дать Online Booking»: clinic или auto-sto. К переносу billing **не относится**. Решите позже, когда будете брать Platform add-on `platform_booking`.

---

## Checklist (DELIVERY)

- [x] CP-BILLING-1 Shared contracts (`@era/contracts` subscription snapshot)
- [x] CP-BILLING-2 Orchestrator BillingModule parity (controllers A+B) — **build green**
- [x] CP-BILLING-3 Super-Admin pricing API (C)
- [x] CP-BILLING-4 Services + monthly worker (D)
- [x] CP-BILLING-5 DB single writer (E) — Finance signup → `POST /internal/v1/subscription/provision-trial`; guards read CP via `ControlPlanePrismaService`
- [x] CP-BILLING-6 Finance web + quota switch (F)
- [x] CP-BILLING-7 Early access move (H)
- [x] CP-BILLING-8 Referrals & Partner move (I)
- [x] CP-BILLING-9 Remove Finance billing + referrals code
- [x] CP-BILLING-10 E2E + webhook cutover + referral accrual tests — `npm run platform:billing-reconcile` on orchestrator; UAT: [UAT-SMOKE-PLATFORM.md](../era-365-orchestrator/doc/UAT-SMOKE-PLATFORM.md)

После всех галочек — **CP-BILLING done**. Затем DOC-B Wave 1, затем CP-B2.
