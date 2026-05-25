# ERA Auto STO — Product Requirements Document (PRD)

> Автосервис: заказ-наряд, работы, запчасти. Счёт и склад — **Finance**.  
> Entitlement: `industry_auto_sto` · Host: `auto.era.az` (3304)

---

## §1. Vision

SMB СТО ведут заказ-наряды в Excel; запчасти и выручка не синхронизированы с бухгалтерией.

**Решение:** work order lifecycle → `SATELLITE_AUTO_WORK_ORDER_CLOSED` → service invoice + parts consumption in Finance.

**Out-of-scope v1:** VIN decoder API, warranty OEM portals, body shop paint formulas.

---

## §2. Benchmark reference

| Бенчмарк | Что заимствуем |
|----------|----------------|
| **Shopmonkey** | Work order UX, labor + parts lines |
| **Tekmetric** | Status pipeline, customer vehicle |
| **1C автосервис** (CIS) | Заказ-наряд → счёт |

---

## §3. Personas & roles

> RBAC: [docs/SATELLITE_DOCUMENTATION.md](../docs/SATELLITE_DOCUMENTATION.md) § Identity & RBAC.

| Роль | Код | Описание |
|------|-----|----------|
| Владелец бизнеса | `BUSINESS_OWNER` | Маппинг `OWNER`/`DIRECTOR`; биллинг — Finance |
| Приёмщик | `SERVICE_ADVISOR` | Заказ-наряды |
| Механик | `TECHNICIAN` | Работы по ЗН |
| Менеджер СТО | `STO_MANAGER` | Боксы, персонал точки |

---

## §4. Modules

| ID | Module | Status | Finance |
|----|--------|--------|---------|
| M0 | Shell | **MVP** | — |
| M1 | Customer vehicle card | **PLANNED** | Counterparty in Finance |
| M2 | Work order | **PLANNED** | `WORK_ORDER_CLOSED` |
| M3 | Labor lines | **PLANNED** | laborAmount |
| M4 | Parts lines (SKU ref) | **PLANNED** | partsAmount + stock OUT |
| M5 | Appointment calendar | **DEFERRED** | — |

---

## §5. User stories

| ID | История |
|----|---------|
| A-01 | Создать ЗН по госномеру |
| A-02 | Добавить работы и запчасти |
| A-03 | Закрыть ЗН → событие в Finance |
| A-04 | Печать заказ-наряда для клиента |

---

## §6. Integrations

`SATELLITE_AUTO_WORK_ORDER_CLOSED` — workOrderId, laborAmount, partsAmount, vehiclePlate.

---

## §7. Phases

A0 done · A1 work order E2E · A2 appointments · A3 VIN/parts catalog API

---

## §8. Changelog

2026-05-24 PRD v1.0
