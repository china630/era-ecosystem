# Satellite documentation standard

Every ERA industry satellite follows this layout. **DELIVERY** is the source of truth for checkboxes; **PRD §3** summarizes module status for PM.

## Umbrella (shared)

| Document | Path |
|----------|------|
| Global UI/UX | [`DESIGN.md`](../DESIGN.md) — **§ App shell** (header order, sidebar width); kit: `@era/satellite-kit/ui` |
| Local subfolder dev | [`LOCAL_FOLDER_DEV.md`](./LOCAL_FOLDER_DEV.md) — flat monorepo, ports, package build |
| Run all services | [`SETUP_AND_RUN.md`](./SETUP_AND_RUN.md) |
| SSO & event bus | [`INTEGRATION_SSO_EVENTS.md`](./INTEGRATION_SSO_EVENTS.md) |
| Readiness matrices | [`READINESS_MATRIX.md`](./READINESS_MATRIX.md) — DELIVERY %, API × app, integrations; **refresh:** skill `era-readiness-matrix` or `node scripts/delivery-readiness.mjs` (§1) + `node scripts/readiness-coverage.mjs` (§4) |
| Smoke checklist | [`SMOKE_ALL_SERVICES.md`](./SMOKE_ALL_SERVICES.md) |
| This standard | `SATELLITE_DOCUMENTATION.md` |
| Product versions | [PRODUCT_VERSIONING.md](./PRODUCT_VERSIONING.md) |
| Modules catalog + roadmap | [MODULES_CATALOG.md](./MODULES_CATALOG.md#industry-module-roadmap) |
| Industry research (reference) | [ERPs/README.md](../ERPs/README.md) |
| Development roadmap | [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) |
| Implementation plans index | [IMPLEMENTATION_PLANS.md](./IMPLEMENTATION_PLANS.md) |
| In-app user help (policy) | [USER_DOCUMENTATION.md](./USER_DOCUMENTATION.md) |
| Control plane architecture | [CONTROL_PLANE_ARCHITECTURE.md](./CONTROL_PLANE_ARCHITECTURE.md) |
| CP-BILLING migration (archive) | [CP-BILLING-MIGRATION.md](./CP-BILLING-MIGRATION.md) |
| Platform add-ons | [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md) |
| Local UAT gaps | [LOCAL_UAT_GAP_CHECKLIST.md](./LOCAL_UAT_GAP_CHECKLIST.md) |
| Quartet smoke (Hot/FB/Fin/Orch) | [QUARTET_UAT.md](./QUARTET_UAT.md) |
| Hospitality ↔ Finance boundary | [HOSPITALITY_FINANCE_BOUNDARY.md](./HOSPITALITY_FINANCE_BOUNDARY.md) |
| Hotel City Ledger / FO money (P5) | [adr/hotel-city-ledger-and-fo-money.md](./adr/hotel-city-ledger-and-fo-money.md) · coverage `HOT-CASH-*` / `HOT-CL-*` |
| Satellite UI playbook | [UI_PLAYBOOK_SATELLITES.md](./UI_PLAYBOOK_SATELLITES.md) — **`EraAppRouteShell`**, header slots, sidebar checklist |
| Finance ERP docs index | [era-finance-core/docs/README.md](../era-finance-core/docs/README.md) |
| Finance bridge pattern (ADR) | [satellite-finance-bridge-pattern.md](./adr/satellite-finance-bridge-pattern.md) |
| ERA Data Hub (DaaS) ADR | [era-data-hub.md](./adr/era-data-hub.md) |
| Managed lists vs enums (tenant/platform catalogs) | [adr/managed-lists-vs-enums.md](./adr/managed-lists-vs-enums.md) — Wave A/B migration; SatAdmin / Finance / SuperAdmin ownership |
| ERA Data Hub delivery | [era-data-hub/doc/DELIVERY-DATA-HUB.md](../era-data-hub/doc/DELIVERY-DATA-HUB.md) |
| CP ↔ Finance handoff (ADR) | [cp-finance-handoff.md](./adr/cp-finance-handoff.md) |
| Bank Core (CBS) ADR | [era-bank-core.md](./adr/era-bank-core.md) — headless engine + `era-bank` satellite (D9) |
| Bank engine spec | [era-bank-core/PRD.md](../era-bank-core/PRD.md) (product-line lead) · [era-bank-core/TZ.md](../era-bank-core/TZ.md) |
| Bank satellite spec | [era-bank/PRD.md](../era-bank/PRD.md) · [era-bank/TZ.md](../era-bank/TZ.md) (`industry_banking`) |
| Bank scope / acceptance | [Bank-Capability-Inventory.md](./acceptance/Bank-Capability-Inventory.md) · [Bank-Full-CBS-Roadmap.md](./acceptance/Bank-Full-CBS-Roadmap.md) · [Bank-Product-Readiness-Matrix.md](./acceptance/Bank-Product-Readiness-Matrix.md) — Full commercial CBS program (mvp until field) |
| Bank DBO channel | [era-bank-dbo/doc/DELIVERY-BANK-DBO.md](../era-bank-dbo/doc/DELIVERY-BANK-DBO.md) · `:3211` retail/corporate PWA |

## Per-satellite layout

```
era-{name}/
  PRD.md
  TZ.md
  README.md
  doc/
    DELIVERY-{NAME}.md
    UAT-SMOKE.md
    DOCUMENTATION-INDEX.md
    clone-spec/
      00-vision-and-boundaries.md
      01-finance-boundary.md
```

## i18n stacks (ecosystem contract)

| Web node | Stack | Locales | Default | Cookie | Fallback |
|----------|-------|---------|---------|--------|----------|
| **era-finance-core** | `react-i18next` + `@erafinance/i18n` | az, ru, en | **az** | `era_i18n_lang` (+ legacy `erafinance_i18n_lang`) | EN/RU → az (`fallbackLng`) |
| **era-hotel-pms**, **era-fnb-pos** | `next-intl` + `@era/i18n-common` | az, ru, en | **az** | `era_i18n_lang` (+ legacy `NEXT_LOCALE`) | deep-merge on `messages/az.json` |
| **era-orchestrator** web | `next-intl` + `@era/i18n-common` | az, ru, en | **az** | `era_i18n_lang` | same |
| **Industry satellites** (retail, logistics, clinic, auto, wholesale, construction, crm) | `next-intl` + `@era/i18n-common` | az, ru, en | **az** | `era_i18n_lang` | same |

Shared package: [`packages/i18n-common`](../packages/i18n-common) (`resolveLocale`, `mergeMessages`, `createNextIntlRequest`, `common.{az,ru,en}.json`). Public UI: `@era/satellite-kit/ui` — `LocaleToggle`, `FaqSection`, `PublicLegalFooter`, `resolveLegalUrls`.

Hotel detail: [era-hotel-pms/doc/i18n.md](../era-hotel-pms/doc/i18n.md). Switcher posts to `POST /api/locale`.

## In-app help (satellites)

User-facing FAQ on industry apps links to **Orchestrator** `/help` via `orchPublicHref("/help")`. Local satellite `/help` may exist for ops; canonical copy lives in `era-orchestrator/apps/web/messages/*.json`. Legal links: env `NEXT_PUBLIC_ERA_*` or Orch `/terms`. Policy: [USER_DOCUMENTATION.md](./USER_DOCUMENTATION.md).

## Public login UI (`AuthLoginCard`)

All industry satellites, Orchestrator, and Finance `/login` share the same layout ([DESIGN.md](../DESIGN.md)):

| Element | Implementation |
|---------|----------------|
| Card | `@era/satellite-kit/ui` → `AuthLoginCard` |
| Copy | `@era/i18n-common` keys `auth.*` (+ app overlays) |
| Locale toggle | Header row, right of title — `SatelliteLocaleToggle` / Finance `LanguageSwitcher` |
| Credential field | Login **or** email **or** phone (single field) + password |
| Links (order) | need account → register org → pricing → FAQ; user agreement → Orch `/terms` |
| Cross-app URLs | `orchPublicHref()` from `@era/satellite-kit/ui` (not main kit barrel) |

**API:** `POST /api/auth/login` on each satellite resolves user by login/email/phone and verifies scrypt hash (`@era/satellite-kit/auth`). SSO path unchanged: `POST /api/auth/sso/exchange`.

**Middleware:** whitelist `POST /api/locale` and public pages (`/login`, `/help`) so locale switch works without session.

## PRD.md required sections

1. **Vision** — scope and explicit out-of-scope
2. **Personas & roles** — operational roles + `BUSINESS_OWNER` (see below); link to RBAC in TZ / clone-spec
3. **Modules** — table with status: `PLANNED | IN_PROGRESS | MVP | DONE | DEFERRED`
4. **User stories** — IDs and acceptance criteria
5. **Integrations** — orchestrator events, Finance handoff
6. **Release phases** — use [PRODUCT_VERSIONING.md](./PRODUCT_VERSIONING.md) (`v1.0` shipped · `v1.1` / `v2.0` planned)
7. **Changelog**

## Identity & RBAC (control plane)

**Целевая архитектура:** единый **RBAC и владение аккаунтом** на **`era-orchestrator`**; Finance и спутники — **потребители** JWT и membership, без дублирования «владельца SaaS» в доменных БД спутников.

| Контур | Что хранит / решает |
|--------|---------------------|
| **Orchestrator** | Identity (login, refresh), **organization membership**, роли `OWNER` / `ADMIN` / `ACCOUNTANT` / …, **`organizations.ownerId`**, transfer ownership, **access requests** (join by VÖEN), **ownership dispute / arbitration**, entitlements для satellite SSO |
| **Finance Core** | Доменный RBAC на API (guards), биллинг платформы, финансовые политики; при `ERA_AUTH_MODE=control-plane` — trust JWT от orchestrator; RBAC mutations proxied when `ERA_CONTROL_PLANE_RBAC_PROXY=true` |
| **Satellite** | Только **операционные** роли (кассир, врач, диспетчер…); опционально локальная матрица для offline/dev |

**Cutover (Phase A complete):** membership, access requests, transfer ownership, and disputes are canonical on orchestrator. Finance API forwards matching routes to control plane when `ERA_CONTROL_PLANE_RBAC_PROXY` is enabled (default `true`).

### Роль `BUSINESS_OWNER` (обязательна в PRD §3 каждого спутника)

| Поле | Значение |
|------|----------|
| **Код в спутнике** | `BUSINESS_OWNER` |
| **Источник** | Маппинг из orchestrator/Finance: пользователь с ролью **`OWNER`** или **`DIRECTOR`** в активной организации |
| **Смысл** | Владелец бизнеса и аккаунта SaaS: подписка, пользователи, VÖEN, transfer ownership — **только** в Finance/orchestrator, не в satellite DB |
| **В спутнике** | Сводные дашборды, read-only аудит, утверждение критичных операций (void, скидки, закрытие периода точки), deep link «управление подпиской» → Finance |
| **Не путать с** | `CLINIC_ADMIN`, `OUTLET_ADMIN` — операционные админы точки без биллинга |

**SSO (Phase A):** all **7 industry satellites** use `@era/satellite-kit` **`executeSatelliteSsoExchange`** in `app/api/auth/sso/exchange/route.ts`. The helper maps `financeRole` → `BUSINESS_OWNER` (when `OWNER`/`DIRECTOR`) or `SATELLITE_OPERATOR`, persists a local SSO user, and signs a session JWT with `organizationId`, `roles[]`, `isOwner`, `financeRole`.

| App | SSO route | `BUSINESS_OWNER` in PRD §3 |
|-----|-----------|----------------------------|
| era-retail-pos | `app/api/auth/sso/exchange/route.ts` | yes |
| era-logistics | same pattern | yes |
| era-construction | same pattern | yes |
| era-crm | same pattern | yes |
| era-auto-service | same pattern | yes |
| era-wholesale | same pattern | yes |
| era-clinic | same pattern | yes |

Use `requireRole(session, 'BUSINESS_OWNER')` for executive routes (pilot: `era-retail-pos/app/executive`).

**Hybrid (v1.0):** `era-fnb-pos` and `era-hotel-pms` keep **local operational** users (waiter, reception, FB_MANAGER). **Platform** users (OWNER/DIRECTOR/ADMIN/ACCOUNTANT) enter via **Orchestrator SSO** → `financeRole` in session; RBAC mutations stay in Finance/Orch only.

### UAT-SMOKE template — SSO paths (required in every `era-*/doc/UAT-SMOKE.md`)

```markdown
## SSO paths (platform entry — v1.0)

### Owner path (Orchestrator)
1. Login at Orchestrator web: `http://localhost:3000` ([QUARTET_UAT.md](../../docs/QUARTET_UAT.md)).
2. Home → industry tile → **Open** → satellite `/sso/callback` session.
3. Smoke: `node scripts/sso-launch-smoke.mjs` (`ERA_SSO_SHARED_SECRET` aligned).

### Ops path (local)
1. Use this app's `/login` and seed users in sections below.
2. Billing, team, register → Orchestrator only (no satellite `/register`).
```

**Шаблон для PRD §3** (добавить первой строкой в таблицу персон):

```markdown
| Владелец бизнеса | `BUSINESS_OWNER` | Маппинг `OWNER`/`DIRECTOR` из control plane; биллинг — Finance |
```

## Natural-person MDM (cross-satellite)

- **SoR:** Orchestrator `era_mdm` — store **`globalPersonId` only** in satellite DBs.
- **Client:** `@era/satellite-kit` `linkPersonIdentity` (lookup FIN → resolve-or-create).
- **Clinic:** `PatientRef`, `Practitioner` — strict; `/api/mdm/person-lookup`, `/api/mdm/person-merge`.
- **Hotel:** `Guest` — **strong + ops cache (W4)**; identity MDM-only (`globalPersonId`); masked ops-profile on guest card; transient FIN/passport at intake.
- **Finance:** `Employee`, `Counterparty` (ИП) — `OrchestratorMdmClientService`.
- **Bank:** CIF natural + `POST /cif/customers/:id/beneficial-owners` (API).
- Audit matrix: [MDM_IDENTITY_AUDIT.md](./MDM_IDENTITY_AUDIT.md) · layer compliance [DATA_MODEL_INTEGRATION_AUDIT.md](./DATA_MODEL_INTEGRATION_AUDIT.md) · ADR [era-mdm-natural-person-identity.md](./adr/era-mdm-natural-person-identity.md).

## Reference data (era-data-hub)

- **SoR:** `era-data-hub` `/registry/v1/*` — FX, calendar, HS, banks, VÖEN directory, geo, UoM, tax, CoA templates.
- **Primary consumers:** `era-finance-core`, `era-bank-core` (`ERA_DATA_HUB_ENABLED`, `DATA_HUB_SERVICE_TOKEN`).
- **Industry rule:** sync catalog reads via **Orchestrator Platform Gateway** `GET /platform/v1/catalog/*` (not data-hub or Finance handoffs). HS tariff preview and tenant counterparty ops remain Finance-only.
- ADR: [orchestrator-platform-integration-gateway.md](./adr/orchestrator-platform-integration-gateway.md) · [reference-data-ecosystem.md](./adr/reference-data-ecosystem.md)
- Audit: [REFERENCE_DATA_CONSUMER_AUDIT.md](./REFERENCE_DATA_CONSUMER_AUDIT.md) · layer compliance [DATA_MODEL_INTEGRATION_AUDIT.md](./DATA_MODEL_INTEGRATION_AUDIT.md)

## Finance boundary (all satellites)

- **In Finance:** GL, NAS, full inventory valuation, counterparty MDM, **Contract Management**, **годовой бюджет и исполнение (B2G)**, invoice issuance, WhatsApp **invoice delivery**
- **In satellite:** operational UX, shifts, domain documents, typed outbound events with `correlationId`
- **Never:** duplicate GL posting, master counterparty registry, contract registry, or org-level budget ledger in satellite DB

## Event contract

Publish via `POST {ORCHESTRATOR}/api/v1/satellite-events` with `@era/contracts` Zod types. See [`packages/era-contracts`](../packages/era-contracts).

UI: [`@era/satellite-kit/ui`](../packages/satellite-kit/ui) (DESIGN.md tokens, PageHeader, ModalShell). Auth: `@era/satellite-kit` SSO verify + session helpers.

## Satellite index

| App | PRD | DELIVERY | Port | Host |
|-----|-----|----------|------|------|
| era-hotel-pms | [PRD](../era-hotel-pms/PRD.md) | [DELIVERY](../era-hotel-pms/doc/DELIVERY.md) | 3201 | hotel-pms.era-365.online |
| era-fnb-pos | [PRD](../era-fnb-pos/PRD.md) | [DELIVERY-FB](../era-fnb-pos/doc/DELIVERY-FB.md) | 3202 | fnb-pos.era-365.online |
| era-retail-pos | [PRD](../era-retail-pos/PRD.md) | [DELIVERY-RETAIL](../era-retail-pos/doc/DELIVERY-RETAIL.md) | 3204 | retail-pos.era-365.online |
| era-logistics | [PRD](../era-logistics/PRD.md) | [DELIVERY-LOGISTICS](../era-logistics/doc/DELIVERY-LOGISTICS.md) | 3205 | logistics.era-365.online |
| era-construction | [PRD](../era-construction/PRD.md) | [DELIVERY-CONSTRUCTION](../era-construction/doc/DELIVERY-CONSTRUCTION.md) | 3206 | construction.era-365.online |
| era-crm | [PRD](../era-crm/PRD.md) | [DELIVERY-CRM](../era-crm/doc/DELIVERY-CRM.md) | 3207 | crm.era-365.online |
| era-auto-service | [PRD](../era-auto-service/PRD.md) | [DELIVERY-AUTO](../era-auto-service/doc/DELIVERY-AUTO.md) | 3208 | auto-service.era-365.online |
| era-wholesale | [PRD](../era-wholesale/PRD.md) | [DELIVERY-WHOLESALE](../era-wholesale/doc/DELIVERY-WHOLESALE.md) | 3209 | wholesale.era-365.online |
| era-clinic | [PRD](../era-clinic/PRD.md) | [DELIVERY-CLINIC](../era-clinic/doc/DELIVERY-CLINIC.md) | 3203 | clinic.era-365.online |

**Hotel Elektraweb migration (Stage 26):** [ELEKTRAWEB-IMPORT.md](../era-hotel-pms/doc/ELEKTRAWEB-IMPORT.md) · ADR [hotel-elektraweb-import.md](./adr/hotel-elektraweb-import.md)
