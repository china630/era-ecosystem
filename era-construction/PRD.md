# ERA Construction — Product Requirements Document (PRD)

> Стройка: объекты, смета (BOQ), акты выполненных работ (ops). Закупки, договоры, GL — **Finance**. Кадры/табель SoR — **CP**. Pre-sale до оплаты — **CRM**.  
> Boundaries: [docs/adr/construction-domain-boundaries.md](../docs/adr/construction-domain-boundaries.md)  
> DELIVERY: [doc/DELIVERY-CONSTRUCTION.md](./doc/DELIVERY-CONSTRUCTION.md)

| Параметр | Значение |
|----------|----------|
| **Продукт** | ERA Construction (`era-construction`) |
| **Entitlement** | `industry_construction` |
| **Host** | `construction.era-365.online` (3302) |

---

## §1. Vision

### 1.1. Проблема

Подрядчики ведут объекты и акты в Excel; связь сметы, материалов и выручки в ERP ручная; форма №2 / КС-2 не стандартизирована в системе.

### 1.2. Решение

Сателлит стройки: проект → BOQ → заявка на материалы → акт → событие `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED` → WIP/выручка в Finance.

### 1.3. Critical boundaries (read first)

| Plane | Owns |
|-------|------|
| **era-construction** | Site project, field, ops CDE, BOQ/acts as operational packs |
| **era-finance-core** | Counterparty MDM, commercial contracts, PO, invoices, payments, WIP journals |
| **era-orchestrator (CP)** | Workforce timesheet SoR; entitlements / SSO |
| **era-crm** | Lead → convert (path to payment); not site ops |

Full map: [construction-domain-boundaries.md](../docs/adr/construction-domain-boundaries.md).

### 1.4. Out-of-scope (never in this satellite)

- GL / AR ledger, commercial contract registry, payment rails (Finance)
- Payroll / month attendance SoR (CP → Finance bridge)
- Lead pipeline / proposals as CRM screens (CRM)
- Full partner-certified CDE; BIM authoring
- Public customer webhook product (separate platform ADR if sold)

---

## §2. Benchmark reference

Market suites (Procore, ACC, Oracle, Buildertrend, Fieldwire) are **capability sources**. Features are mapped onto ERA planes; they are not copied as a single-app monolith.

| Бенчмарк | Что заимствуем в **construction** | Что уходит в другие плоскости |
|----------|-----------------------------------|--------------------------------|
| **Procore** | Project, daily log, progress billing pack, change **requests** (ops) | Contracts, Pay, GL → Finance |
| **ACC / Forma** | Docs/sheets ops, issues | BIM authoring / heavy CDE cert → later / out |
| **Oracle Aconex** | Audit-minded docs / RFI ops | CPM mega + Unifier money → Finance/schedule depth |
| **Buildertrend** | BOQ vs actual, selections **after** sale on site | Lead → warranty sales loop → **CRM** + Finance |
| **Fieldwire** | Punch on drawings, offline-oriented field | — |
| **Smeta.az** / **1C субподряд** (AZ/CIS) | Локальные сметы и акты (КС) as templates | Юр. договор и оплаты → Finance |

---

## §3. Personas & roles

> RBAC: [docs/SATELLITE_DOCUMENTATION.md](../docs/SATELLITE_DOCUMENTATION.md) § Identity & RBAC.

| Роль | Код | Описание |
|------|-----|----------|
| Владелец бизнеса | `BUSINESS_OWNER` | Маппинг `OWNER`/`DIRECTOR`; утверждение актов, биллинг — Finance |
| Прораб | `SITE_MANAGER` | Объект, акты |
| Сметчик | `ESTIMATOR` | BOQ |
| Главный инженер | `PROJECT_MANAGER` | Сводка проектов |
| Аудитор (SSO) | `SATELLITE_OPERATOR` | Read-only |

**Variant A (CN-RBAC-01, 2026-10-04):** the codes above are system packages of grants (`screen:` / `api:` / `admin:`), edited on `/admin/access` by the holder of `admin:access_manage` (default `PROJECT_MANAGER`). Every ops package keeps the full project and site flow, including progress act approve (`api:acts.approve`); settings and access go to `PROJECT_MANAGER`. `SATELLITE_OPERATOR` keeps the ops package until someone tightens it to read-only in the matrix. ADR [construction-domain-permissions-and-rbac](../docs/adr/construction-domain-permissions-and-rbac.md).

---

## §4. Modules

| ID | Module | Status | Finance |
|----|--------|--------|---------|
| M0 | Shell | **DONE** | — |
| M1 | Project / site | **DONE** | — |
| M2 | BOQ (смета) | **DONE** | stub C1; flat ops WBS |
| M20 | Estimate hierarchy (5-level smeta pack) | **API** (SCREEN hub Estimate) | Dual mode per project; approve → BoqLine + `SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED`; SOV seed Finance; ADR construction-estimate-hierarchy |
| M21 | Smeta rate engine (norms → estimate lines) | **API** (SCREEN; UAT open) | Org `RateBase`/`RateItem` + optional hub `materialCode`; calc/apply; SatAdmin `/admin/rate-bases`; SKU `construction_smeta_rate_engine`; ADR construction-smeta-rate-engine — not full DESN content; not SHIPPED |
| M3 | Material requisition | **DONE** | PO in Finance Phase 2 |
| M4 | Progress act (КС) | **DONE** | `PROGRESS_ACT_APPROVED` |
| M5 | Photo report | **DEFERRED** | — |
| M6 | Field daily log (прораб) | **DONE** | ERPs/05 §3 |
| M7 | Punch list / defects | **DONE** | Snag list → assignee |
| M8 | Gantt / CPM schedule | **DONE** | ERPs/05 §2 |
| M9 | Subcontractor progress claims | **DONE** | Lite portal; Finance contracts |
| M10 | Site equipment / machine hours | **DONE** | ERPs/05 §6 |
| M11 | CDE / drawing versions | **DONE** | ERPs/05 §7 |
| M12 | Labor timesheets / SKUD | **DONE** | Site import → CP SoR ([workforce-timesheet-construction-bridge](../docs/adr/workforce-timesheet-construction-bridge.md)) |
| M13 | Progress act lines (ops SOV) | **API** (SCREEN; UAT open) | Hub Ops tab; journal `construction:{actId}`; soft `financePayAppId` ref; not Finance ledger; not SHIPPED |
| M14 | Project parties | **API** (SCREEN; UAT open) | Hub Depth; Finance counterparty ref only |
| M15 | RFI (ops) | **API** (SCREEN; UAT open) | Answer + dueDate; impact flags |
| M16 | Change request (ops) | **API** (SCREEN; UAT open) | Ops approve; money settle → Finance |
| M17 | Submittal (ops) | **API** (SCREEN; UAT open) | Status transitions |
| M18 | Site inspection / form | **API** (SCREEN; UAT open) | FAIL → punch |
| M19 | Project phases / locations | **API** (SCREEN; UAT open) | Hub Structure CRUD + soft-delete |

### Wave 1 scaffold inventory (2026-11-17)

Skeleton only (STUB/API + UI empty shells). Not SHIPPED / not Pilot / not sell GA. Boundaries: [construction-domain-boundaries.md](../docs/adr/construction-domain-boundaries.md).

| Area | Model / API | UI shell |
|------|-------------|---------|
| Parties | `ProjectParty` · `GET/POST …/parties` | `/projects/[id]` section |
| Phases / locations | `ProjectPhase`, `ProjectLocation` | same |
| RFI / Submittal / Inspection | `Rfi`, `Submittal`, `SiteInspection` | sections + Wave 2+ |
| Change request | `ChangeRequest` | section |
| Act lines | `ProgressActLine` (M13) | MVP panel on `/projects/[id]` (SCREEN) |
| CDE sheet fields | `DrawingRevision.sheetNumber/status` | via CDE |
| Soft-delete | `deletedAt` on ops rows | — |
| Events | contract stubs in `@era/contracts` | — |

См. [MODULES_CATALOG § roadmap](../docs/MODULES_CATALOG.md#industry-module-roadmap) · [PRODUCT_VERSIONING](../docs/PRODUCT_VERSIONING.md).  
MODULES_CATALOG **DONE** ≠ Pilot / edition `ga` — see Acceptance / Product-Readiness.

---

## §5. User stories

| ID | История | Phase |
|----|---------|-------|
| C-01 | Создать объект с BOQ | C1 |
| C-02 | Заявка на материал на объект | C1 |
| C-03 | Утвердить акт за период | C1 |
| C-04 | Сравнение план/факт по BOQ | C2 |

---

## §6. Integrations

| Event | Finance effect |
|-------|----------------|
| `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED` | WIP / revenue journal (111/601) |

Material purchase → Finance procurement (not satellite GL).

---

## §7. Release phases

| Phase | Scope |
|-------|--------|
| C0 | Scaffold (done) |
| C1 | Project + act + event E2E |
| C2 | BOQ variance, requisition workflow |

---

## §8. Changelog

| Date | Note |
|------|------|
| 2026-11-23 | Pilot W2–W4: Finance bridge UX; act `financePayAppId`; rate hub `materialCode`; UAT/Demo TE templates — not SHIPPED / ga |
| 2026-05-24 | PRD v1.0 |
| 2026-05-25 | Wave 2 C2: plan-vs-actual API + project/requisition UI |
| 2026-05-28 | Gemini enrichment: M6–M12 (W2 backlog) in §4 |
| 2026-11-17 | Boundaries ADR; CRM/CP/Finance map; M13–M16 depth roadmap |
| 2026-11-17 | Wave 2 MVP: BOQ/acts API + SCREEN lines editor/approve; plan-vs-actual from act lines; Finance journal idempotent |
| 2026-11-18 | Wave 4 product: project hub tabs; structure/schedule/equipment/claims CRUD; status machines; FORBIDDEN UX; no Pilot/ga/SHIPPED |
| 2026-11-18 | Wave 3 depth: parties/CDE supersede/field/RFI/submittal/change ops + stub events; SCREEN panel |
| 2026-11-17 | Wave 1 scaffold: M14–M19 stubs + soft-delete/sheet fields + contract event stubs |
