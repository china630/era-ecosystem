# Satellite documentation standard

Every ERA industry satellite follows this layout. **DELIVERY** is the source of truth for checkboxes; **PRD §3** summarizes module status for PM.

## Umbrella (shared)

| Document | Path |
|----------|------|
| Global UI/UX | [`DESIGN.md`](../DESIGN.md) — shared tokens/components: `@era/satellite-kit/ui` |
| Run all services | [`SETUP_AND_RUN.md`](./SETUP_AND_RUN.md) |
| SSO & event bus | [`INTEGRATION_SSO_EVENTS.md`](./INTEGRATION_SSO_EVENTS.md) |
| Readiness matrices | [`READINESS_MATRIX.md`](./READINESS_MATRIX.md) — DELIVERY %, API × app, integrations; **refresh:** skill `era-readiness-matrix` or `node scripts/delivery-readiness.mjs` (§1) + `node scripts/readiness-coverage.mjs` (§4) |
| Smoke checklist | [`SMOKE_ALL_SERVICES.md`](./SMOKE_ALL_SERVICES.md) |
| This standard | `SATELLITE_DOCUMENTATION.md` |
| Modules catalog + enrichment backlog | [`MODULES_CATALOG.md`](./MODULES_CATALOG.md#industry-enrichment-backlog-gemini-erp--era) |
| Gemini ERP research (reference) | [`ERPs/`](../ERPs/) |
| Industry enrichment backlog (Gemini W1/W2) | [MODULES_CATALOG.md § enrichment](./MODULES_CATALOG.md#industry-enrichment-backlog-gemini-erp--era) · [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) |
| ERP research index | [ERPs/README.md](../ERPs/README.md) |
| Finance bridge pattern (ADR) | [satellite-finance-bridge-pattern.md](./adr/satellite-finance-bridge-pattern.md) |

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

## PRD.md required sections

1. **Vision** — scope and explicit out-of-scope
2. **Personas & roles** — operational roles + `BUSINESS_OWNER` (see below); link to RBAC in TZ / clone-spec
3. **Modules** — table with status: `PLANNED | IN_PROGRESS | MVP | DONE | DEFERRED`
4. **User stories** — IDs and acceptance criteria
5. **Integrations** — orchestrator events, Finance handoff
6. **Release phases**
7. **Changelog**

## Identity & RBAC (control plane)

**Целевая архитектура:** единый **RBAC и владение аккаунтом** на **`era-365-orchestrator`**; Finance и спутники — **потребители** JWT и membership, без дублирования «владельца SaaS» в доменных БД спутников.

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
| era-crm-field | same pattern | yes |
| era-auto-sto | same pattern | yes |
| era-wholesale | same pattern | yes |
| era-clinic | same pattern | yes |

Use `requireRole(session, 'BUSINESS_OWNER')` for executive routes (pilot: `era-retail-pos/app/executive`).

**Hybrid (SP8):** `era-fb-pos` and `era-hotel-pms` keep **local operational** users (waiter, reception, FB_MANAGER). **Platform** users (OWNER/DIRECTOR/ADMIN/ACCOUNTANT) enter via **Orchestrator SSO** → `financeRole` in session; RBAC mutations stay in Finance/Orch only.

### UAT-SMOKE template — SSO paths (required in every `era-*/doc/UAT-SMOKE.md`)

```markdown
## SSO paths (platform entry — SP9/P2)

### Owner path (Orchestrator)
1. Login at Orchestrator web: `http://localhost:3100` ([QUARTET_UAT.md](../../docs/QUARTET_UAT.md)).
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
| era-hotel-pms | [PRD](../era-hotel-pms/PRD.md) | [DELIVERY](../era-hotel-pms/doc/DELIVERY.md) | 3000 | hotel.era.az |
| era-fb-pos | [PRD](../era-fb-pos/PRD.md) | [DELIVERY-FB](../era-fb-pos/doc/DELIVERY-FB.md) | 3200 | pos.era.az |
| era-retail-pos | [PRD](../era-retail-pos/PRD.md) | [DELIVERY-RETAIL](../era-retail-pos/doc/DELIVERY-RETAIL.md) | 3300 | retail.era.az |
| era-logistics | [PRD](../era-logistics/PRD.md) | [DELIVERY-LOGISTICS](../era-logistics/doc/DELIVERY-LOGISTICS.md) | 3301 | logistics.era.az |
| era-construction | [PRD](../era-construction/PRD.md) | [DELIVERY-CONSTRUCTION](../era-construction/doc/DELIVERY-CONSTRUCTION.md) | 3302 | construction.era.az |
| era-crm-field | [PRD](../era-crm-field/PRD.md) | [DELIVERY-CRM](../era-crm-field/doc/DELIVERY-CRM.md) | 3303 | crm.era.az |
| era-auto-sto | [PRD](../era-auto-sto/PRD.md) | [DELIVERY-AUTO](../era-auto-sto/doc/DELIVERY-AUTO.md) | 3304 | auto.era.az |
| era-wholesale | [PRD](../era-wholesale/PRD.md) | [DELIVERY-WHOLESALE](../era-wholesale/doc/DELIVERY-WHOLESALE.md) | 3305 | wholesale.era.az |
| era-clinic | [PRD](../era-clinic/PRD.md) | [DELIVERY-CLINIC](../era-clinic/doc/DELIVERY-CLINIC.md) | 3306 | clinic.era.az |
