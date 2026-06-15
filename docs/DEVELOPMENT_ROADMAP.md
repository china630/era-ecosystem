# ERA Ecosystem — Development Roadmap

Living index for platform-first delivery. **Per-app checkboxes** stay in DELIVERY files; this doc tracks **platform gate** (done) and **product versions** ([PRODUCT_VERSIONING.md](./PRODUCT_VERSIONING.md)).

## v1.0 — Current release (shipped)

### Platform

Gate passed 2026-05-25. Control plane, SSO on industry satellites, Finance event worker (13 ingress types), contracts, gov budget, billing on orchestrator.

| Area | Status | Doc |
|------|--------|-----|
| Orchestrator RBAC (access, transfer, disputes) | **Done** | [DELIVERY-ORCHESTRATOR](../era-orchestrator/doc/DELIVERY-ORCHESTRATOR.md) |
| Unified SSO + `BUSINESS_OWNER` | **Done** | [INTEGRATION_SSO_EVENTS](./INTEGRATION_SSO_EVENTS.md) |
| Finance control-plane auth | **Done** | [SETUP_AND_RUN](./SETUP_AND_RUN.md) |
| Contract Management §4.15 | **Done** | Finance `/contracts` |
| Gov Budget §4.16 | **Done** | Finance `/gov-budget` |
| CP-BILLING + platform add-ons MVP API | **Done** | [PLATFORM_ADDONS](./PLATFORM_ADDONS.md) · [CP-BILLING-MIGRATION](./CP-BILLING-MIGRATION.md) |
| Posting role profiles (COMMERCIAL/BUDGET/NGO) | **Done** | [ADR posting-role-profiles](./adr/posting-role-profiles.md) |

### Industry satellites (operations + modules)

Core MVP per app DELIVERY (checkout, trips, clinic lab, hotel PMS, FB POS, wholesale B2B, construction acts, etc.) plus **industry modules in v1.0** — see [MODULES_CATALOG § Shipped v1.0](./MODULES_CATALOG.md#shipped-in-v10).

Hospitality Nafta package (sanatorium, banquets, GL bridge, invoice center, contract pricing) — **Done** · [era-hotel-pms/doc/nafta/](../era-hotel-pms/doc/nafta/).

---

## v1.1 — Shipped (2026-05-26)

**Scope:** [MODULES_CATALOG § Shipped v1.1](./MODULES_CATALOG.md#shipped-in-v11) — retail M14–M16, clinic M10–M13, logistics tariffs/COD, CRM automation, construction/auto/wholesale/fb, hotel polish.

**Plan:** [IMPLEMENTATION_PLANS.md](./IMPLEMENTATION_PLANS.md) · [.cursor/plans/era_v1.1_release_75a73624.plan.md](../.cursor/plans/era_v1.1_release_75a73624.plan.md).

**Finance APIs:** `era-finance-core/apps/api/src/industry-handoffs/` — stock-check, replenishment, supplier-match, rate-quote, cod-clearing, eligibility, external PO.

---

## v2.0 — Shipped (2026-05-26)

**Scope:** [MODULES_CATALOG § Shipped v2.0](./MODULES_CATALOG.md#shipped-in-v20) — platform add-ons **Live**, MDM registration cutover, retail M8–M10, auto M12, CRM WhatsApp live, clinic portal, hotel NBC KKM / B2C / door locks.

**Plan:** [IMPLEMENTATION_PLANS.md](./IMPLEMENTATION_PLANS.md) · [.cursor/plans/era_v2.0_release_ee4a671b.plan.md](../.cursor/plans/era_v2.0_release_ee4a671b.plan.md).

**Flags:** `ERA_MDM_REGISTRATION_CUTOVER`, `ERA_FISCAL_PROVIDER=mock|nbc`, `PLATFORM_ADDONS_MODE=live`, `WHATSAPP_BUSINESS_MODE=live`.

---

## Ecosystem UX patch (2026-05-30)

Cross-product polish shipped without a version bump:

| Area | Status | Doc |
|------|--------|-----|
| Unified login UI (`AuthLoginCard`) on Orch, Finance, all satellites | **Done** | [DESIGN.md](../DESIGN.md), [SATELLITE_DOCUMENTATION](./SATELLITE_DOCUMENTATION.md) |
| Multi-credential login (login / email / phone) + scrypt passwords | **Done** | `@era/satellite-kit/auth` |
| Orchestrator public hub (`/pricing`, `/help`, `/terms`, `/register`, `/partner`) | **Done** | [ECOSYSTEM_URLS](./ECOSYSTEM_URLS.md) |
| Finance redirects (`/pricing`, `/register*`) → Orch `:3000` | **Done** | `NEXT_PUBLIC_ORCH_WEB_URL` |
| i18n az/ru/en parity + `tools/sync-i18n-parity.mjs` | **Done** | [USER_DOCUMENTATION](./USER_DOCUMENTATION.md) |
| `platform_storage` add-on + `@era/storage` package | **Done** | [PLATFORM_ADDONS](./PLATFORM_ADDONS.md) |

---

## pre-GA — Shipped (2026-05-25)

**Scope:** Platform hooks Hotel/FB, retail offline UI, Finance Phase 16 billing wire, MDM/VÖEN, hotel prod polish, DVX/ƏMAS Phase 2 docs.

**Plan:** [IMPLEMENTATION_PLANS.md](./IMPLEMENTATION_PLANS.md) · [.cursor/plans/era_pre-ga_hardening_447867e7.plan.md](../.cursor/plans/era_pre-ga_hardening_447867e7.plan.md).

---

## Module maturity (pre-GA)

**Plan:** [IMPLEMENTATION_PLANS.md](./IMPLEMENTATION_PLANS.md) · [.cursor/plans/era_modules_catalog_maturity_2dc76166.plan.md](../.cursor/plans/era_modules_catalog_maturity_2dc76166.plan.md).

| Milestone | Status |
|-----------|--------|
| M-sync — false **PLANNED** cleared (v1.1 shipped APIs) | **Done** |
| M1 — v1.1 modules **DONE** (UAT + TZ + SMOKE) | **Done** |
| M2 — v1.0 / v2.0 core **DONE** (hotel M18–23, FB M11–13, retail M8–10, logistics v1.0 pack) | **Done** |
| M3 — Auto M1 vehicle card, M3/M4 labor & parts lines | **Done** |
| M4 — Orch launcher **MVP**; Finance catalog Status column | **Done** |
| M5 — Con M5 **DEFERRED**; hotel Full PO/FA out-of-scope | **Done** |

**MVP backlog closure (2026-05-26):** [MODULES_CATALOG.md § MVP backlog](./MODULES_CATALOG.md#mvp-backlog-priority) — **closed** except Finance Manufacturing/IFRS (tier 2+/3) and Con M5 **DEFERRED**.

**Residual catalog MVP:** Manufacturing, IFRS only (~2 rows). Integration gaps: none ([READINESS_MATRIX.md](./READINESS_MATRIX.md) §4.3).

**Open testing (2026-05-27):** Closed/local UAT **go** — see [READINESS_MATRIX §6](./READINESS_MATRIX.md#6-open-testing-gate-2026-05-27). Ecosystem i18n + FAQ/legal shipped; staging smoke before external GA.

---

## ERA Data Hub (Reference Data / DaaS) — Pass 2 shipped 2026-06-02

Сервис **`era-data-hub`** (`data.era-365.online`), продукт `platform_reference_data`. Спека и вынос из ядра: [ADR era-data-hub](./adr/era-data-hub.md) · планы: [Pass 1](../.cursor/plans/era_data_hub_p1_6337429e.plan.md) · [Pass 2](../.cursor/plans/era_data_hub_pass_2_7f78d60e.plan.md) · [DELIVERY](../era-data-hub/doc/DELIVERY-DATA-HUB.md).

| Этап | Scope | Статус |
|------|-------|--------|
| Пилот | Курсы (1) → Банки/IBAN (7+8) → VÖEN (6) | **Done** — CBAR ingest in hub, finance consumer |
| P1 green/yellow | 1, 2, 3, 6, 7, 8, 9, 10, 11, 12 | **Live** — Redis cache, hub SoR cutover path |
| Orchestrator keys | `validate-key` + audit meter | **Live** (dev keys + entitlement) |
| P2/P3 red | 4, 5, 13–24 | **Planned** |

---

## ERA Sanatorium v-next (Clinic ⊕ Hotel ⊕ Retail) — Proposed 2026-06-03

Доработки следующей версии по сателлитам **`era-clinic`** и **`era-hotel-pms`** + кросс-сателлитная интеграция через оркестратор (брокер-медиатор + подключаемые адаптеры `finance-core`/1С). Решения: [ADR sanatorium-vnext](./adr/sanatorium-vnext.md) (SV1–SV14) · план/волны: [SANATORIUM-VNEXT-PLAN.md](./SANATORIUM-VNEXT-PLAN.md).

| Волна | Scope | Статус |
|-------|-------|--------|
| 0 — Фундамент | контракты + identity/QR (`era_mdm`) + `patientOrigin` + `AccountingAdapter` | **Proposed** |
| 1 — UX клиники *(приоритет)* | Smart Scheduler + check-in, карточка визита/CPOE-UI + МКБ, рабочие места врача/медсестры, безопасный портал + виджет, sync каталога, касса + `@era/fiscal` | **Proposed** |
| 2 — Кросс-санаторий | lifecycle-события отеля, origin-routing на folio, Sanatorium Scheduler, Program Templates + квота, retail reserve/write-off, QR | **Proposed** |
| 3 — Декаплинг/чистка | удаление медконтура отеля, `external/1С` adapter, сага B2C-путёвки | **Proposed** |

**Future:** `hold` (предавторизация) + политика `deposit\|hold\|none`; единый `@era/fiscal` + реальный НБК KKM; `era-spa-pos`; мед-справочники в Data Hub.

---

## Nafta gap closure — W0 (2026-06-13)

Cross-cutting quick wins from Nafta TZ mapping ([`.cursor/plans/nafta_tz_gap_backlog.plan.md`](../.cursor/plans/nafta_tz_gap_backlog.plan.md)).

| Track | Scope | Status |
|-------|-------|--------|
| W0-1 | Child pricing bands → `pricing-engine-core` + reservation recalc | **Done** |
| W0-2 | Reports: booking sources, cancellations, demographics (`/reports/analytics`) | **Done** |
| W0-3 | Finance HR cron: contract T-7d + birthday → notifications | **Done** |
| W0-4 | Clinic lab publish + appointment SMS notify | **Done** |
| OTA-D1 | ADR [hotel-ota-adapter-strategy.md](./adr/hotel-ota-adapter-strategy.md) | **Done** |
| OTA-D2/D3 | `ChannelAdapter` registry + webhook ingest + availability push | **Done** |

## Nafta gap closure — W1–W3 (2026-06-13)

| Wave | Scope | Status |
|------|-------|--------|
| W1 | Satellite mutation audit, agency profitability, FB daily menu, room-plan extend recalc | **Done** |
| W2 | OTA pull/cancel/modify, NBC HTTP fiscal, glPosted callback, procurement RFQ, supplier scorecard, HR docs, door lock vendor | **Done** |
| W3 | AccountingAdapter + fan-out, clinic EMR MVP, queue, LIS profiles, hotel clinic HTTP gate | **Done** |

**Out of product (confirmed):** PD.FORMA.01–05, LDAP/AD.

---

## Hospitality product backlog (post-Nafta W3)

Gaps **not** covered by sibling satellites (hotel + fb + clinic + finance + orchestrator). Full IDs and notes: [era-hotel-pms/doc/BACKLOG-PRODUCTION.md § Product gaps](../era-hotel-pms/doc/BACKLOG-PRODUCTION.md#product-gaps--not-covered-by-other-satellites-2026-06-14).

| Priority | IDs | Theme |
|----------|-----|-------|
| **P2** | H-BL-01 … H-BL-10 | Split settlement, pre-auth, credit limit, meal gate, business date, guest omnichannel, guest intelligence, Stage 25 pricing, early/late charges, deposit lifecycle |
| **P3** | H-BL-20 … H-BL-28 | Excursions, smart minibar, dispatch, KBS, e-qaimə, extra OTA, guest CRM P2/P3, loyalty redeem, clinic procedure rules |
| **P4** | H-BL-30 … H-BL-31 | B2B contract management / agency sales; full MICE (future — confirm Nafta) |

Pick next wave from **P2** unless Nafta onsite UAT surfaces a blocker elsewhere.

---

---

## Bank CBS MVP — Shipped (2026-06-14)

Headless **era-bank-core** (P0–P7) + ops **era-bank** + customer **era-bank-dbo**. All `banking_*` modules at **MVP** in [READINESS_MATRIX.md](./READINESS_MATRIX.md).

| Deliverable | Doc |
|-------------|-----|
| Engine DELIVERY P0–P7 | [DELIVERY-BANK-CORE](../era-bank-core/doc/DELIVERY-BANK-CORE.md) |
| Full-stack UAT | [UAT-SMOKE-FULL](../era-bank-core/doc/UAT-SMOKE-FULL.md) |
| Security / performance | [SECURITY-CHECKLIST](../era-bank-core/doc/SECURITY-CHECKLIST.md) · [PERFORMANCE](../era-bank-core/doc/PERFORMANCE.md) |

---

## Standards

- [PRODUCT_VERSIONING.md](./PRODUCT_VERSIONING.md) — naming rules
- [SATELLITE_DOCUMENTATION.md](./SATELLITE_DOCUMENTATION.md) — layout, RBAC, index
- [MODULES_CATALOG.md](./MODULES_CATALOG.md) — module IDs per app
- [READINESS_MATRIX.md](./READINESS_MATRIX.md) — DELIVERY % and API × app
- [INTEGRATION_SSO_EVENTS.md](./INTEGRATION_SSO_EVENTS.md) — JWT + event bus
- [SETUP_AND_RUN.md](./SETUP_AND_RUN.md) — local run

## Definition of Done

1. Code + migrations + happy-path test
2. DELIVERY checkboxes updated
3. PRD §4 module status + §8 changelog
4. TZ API/Prisma sync
5. UAT-SMOKE steps documented
6. `SMOKE_ALL_SERVICES.md` section if service touched

## Satellite index

See [SATELLITE_DOCUMENTATION.md § Satellite index](./SATELLITE_DOCUMENTATION.md).
