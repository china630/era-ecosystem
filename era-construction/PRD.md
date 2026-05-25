# ERA Construction — Product Requirements Document (PRD)

> Стройка: объекты, смета (BOQ), акты выполненных работ. Закупки и PSA — **Finance**.  
> DELIVERY: [doc/DELIVERY-CONSTRUCTION.md](./doc/DELIVERY-CONSTRUCTION.md)

| Параметр | Значение |
|----------|----------|
| **Продукт** | ERA Construction (`era-construction`) |
| **Entitlement** | `industry_construction` |
| **Host** | `construction.era.az` (3302) |

---

## §1. Vision

### 1.1. Проблема

Подрядчики ведут объекты и акты в Excel; связь сметы, материалов и выручки в ERP ручная; форма №2 / КС-2 не стандартизирована в системе.

### 1.2. Решение

Сателлит стройки: проект → BOQ → заявка на материалы → акт → событие `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED` → WIP/выручка в Finance.

### 1.3. Out-of-scope v1

- Полный субподряд tender portal
- BIM / CAD integration
- Payroll строителей

---

## §2. Benchmark reference

| Бенчмарк | Что заимствуем |
|----------|----------------|
| **Procore** | Project, daily log, progress billing |
| **PlanRadar** | Defect/snag (later) |
| **Buildertrend** | BOQ vs actual |
| **Smeta.az** / **1C субподряд** (AZ/CIS) | Локальные сметы и акты |

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

---

## §4. Modules

| ID | Module | Status | Finance |
|----|--------|--------|---------|
| M0 | Shell | **MVP** | — |
| M1 | Project / site | **PLANNED** | — |
| M2 | BOQ (смета) | **PLANNED** | — |
| M3 | Material requisition | **PLANNED** | PO in Finance Phase 2 |
| M4 | Progress act (КС) | **PLANNED** | `PROGRESS_ACT_APPROVED` |
| M5 | Photo report | **DEFERRED** | — |

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
| 2026-05-24 | PRD v1.0 |
| 2026-05-25 | SP4 C2: material requisition API |
