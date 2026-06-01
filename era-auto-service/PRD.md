# ERA Auto STO — Product Requirements Document (PRD)

> Автосервис: заказ-наряд, работы, запчасти. Счёт и склад — **Finance**.  
> Entitlement: `industry_auto_service` · Host: `auto-service.era-365.online` (3304)

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
| M0 | Shell | **DONE** | — |
| M1 | Customer vehicle card | **DONE** | `/api/vehicles` + WO UI; VÖEN counterparty |
| M2 | Work order | **DONE** | `WORK_ORDER_CLOSED` |
| M3 | Labor lines | **DONE** | labor-lines CRUD → `laborAmount` |
| M4 | Parts lines (SKU ref) | **DONE** | part-lines + Finance stock check |
| M5 | Appointment calendar + service bays | **DONE** | A2 appointments; bay/lift v1.1 |
| M6 | Interactive intake (photos, checklist) | **DONE** | ERPs/02 §1 |
| M7 | Parts catalogue VIN / cross-reference | **DONE** | TecDoc / Mitchell |
| M8 | Shop floor time tracking | **DONE** | ERPs/02 §4 |
| M9 | Parts line status on WO | **DONE** | ordered → arrived → issued |
| M10 | Vehicle history by VIN | **DONE** | ERPs/02 §7 |
| M11 | B2B parts procurement from WO | **DONE** | **Finance** PO |
| M12 | Tool crib / equipment tracking | **DONE** | `/api/tools`, checkout |

См. [MODULES_CATALOG](../docs/MODULES_CATALOG.md#industry-module-roadmap).

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
2026-05-25 Wave 2 A2: `/appointments` UI
2026-05-28 Gemini enrichment M5–M12 (W2) in §4
2026-05-25 Module maturity: M1 vehicle card, M3/M4 labor & parts lines (API)
