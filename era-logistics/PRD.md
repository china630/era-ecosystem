# ERA Logistics — Product Requirements Document (PRD)

> Экспедирование и автопарк: рейсы, путевые, POD. Таможня GL — **Finance** (`trade_pro`).  
> TZ: [TZ.md](./TZ.md) · DELIVERY: [doc/DELIVERY-LOGISTICS.md](./doc/DELIVERY-LOGISTICS.md)

| Параметр | Значение |
|----------|----------|
| **Продукт** | ERA Logistics (`era-logistics`) |
| **Entitlement** | `industry_logistics_customs` |
| **Host** | `logistics.era.az` (3301) |

---

## §1. Vision

### 1.1. Проблема

Перевозчики ведут рейсы в Excel и бумажных путевых; выручка и ГСМ не попадают в ERP вовремя; таможенные расходы учитываются отдельно.

### 1.2. Решение

Operational TMS-lite: fleet, trip, waybill, POD → событие `SATELLITE_LOGISTICS_TRIP_COMPLETED` → начисление freight в Finance.

### 1.3. Out-of-scope v1

- Полный customs declaration filing (GTK) — Finance customs module
- Мультимодальные контейнерные терминалы
- GPS telematics hardware integration

---

## §2. Benchmark reference

| Бенчмарк | Что заимствуем |
|----------|----------------|
| **Transporeon** / **Trimble** | Trip sheet, status, POD |
| **Oracle TMS** (simplified) | Route, vehicle assignment |
| **1C:УТ** + ЭДО (CIS) | Связка рейс → документ → GL (у нас Finance worker) |
| **Local AZ forwarders** | Waybill (путевой), fuel norms |

---

## §3. Personas & roles

> RBAC: [docs/SATELLITE_DOCUMENTATION.md](../docs/SATELLITE_DOCUMENTATION.md) § Identity & RBAC.

| Роль | Код | Описание |
|------|-----|----------|
| Владелец бизнеса | `BUSINESS_OWNER` | Маппинг `OWNER`/`DIRECTOR`; KPI флота, биллинг — Finance |
| Диспетчер | `DISPATCHER` | Рейсы, назначение ТС |
| Водитель | `DRIVER` | Mobile stub, статус рейса |
| Аудитор (SSO) | `SATELLITE_OPERATOR` | Read-only |

---

## §4. Modules

| ID | Module | Status | Finance |
|----|--------|--------|---------|
| M0 | Platform shell | **MVP** | — |
| M1 | Fleet (vehicle, driver) | **PLANNED** | — |
| M2 | Trip planning & status | **MVP** | `TRIP_COMPLETED` |
| M3 | Waybill document | **MVP** | `POST /api/trips/:id/waybill` |
| M4 | POD (photo/signature stub) | **MVP** | — |
| M5 | Fuel norm per trip | **MVP** | Cost event Phase 2 |
| M6 | Customs handoff flag | **MVP** | Finance `trade_pro` read hub — DELIVERY L3 |
| **M7** | **Fleet compliance** | Fleet docs | **MVP** | `GET /api/fleet/alerts`, `/fleet` UI |
| M4 (extend) | POD photo + signature | Last mile | **MVP** | `podPhotoUrl`, `podSignatureUrl` on `Trip` |
| M8 | Multi-stop trip (`trip_points`) | VRP lite | **W2 PLANNED** | Gemini 06 §2 |
| M9 | Driver mobile workflow API | Last mile | **W2 PLANNED** | Gemini 06 §3 |
| M10 | Rate matrix / tariffs | OMS billing | **W2 DEFERRED** | **Finance** |
| M11 | COD split & clearing | Courier COD | **W2 DEFERRED** | **Finance** |
| M12 | Hub cross-dock scanning | WMS hub | **W2 DEFERRED** | Gemini 06 §6 |
| M13 | Customer tracking portal | Visibility | **W2 PLANNED** | **PLATFORM** `portal` |

См. [MODULES_CATALOG § enrichment](../docs/MODULES_CATALOG.md#industry-enrichment-backlog-gemini-erp--era).

---

## §5. User stories

| ID | История | Phase |
|----|---------|-------|
| L-01 | Создать рейс с маршрутом | L1 |
| L-02 | Назначить ТС и водителя | L1 |
| L-03 | Закрыть рейс с freight amount | L1 |
| L-04 | POD подтверждение доставки | L2 |
| L-05 | Отчёт ГСМ по рейсу | L2 |

---

## §6. Integrations

| Event | Payload highlights | Finance |
|-------|-------------------|---------|
| `SATELLITE_LOGISTICS_TRIP_COMPLETED` | tripId, vehicleId, freightAmount | Journal 201/601 |

---

## §7. Release phases

| Phase | Scope |
|-------|--------|
| L0 | Scaffold (done) |
| L1 | Trip + complete event E2E |
| L2 | POD, fuel, reports |
| L3 | Customs status sync from Finance |

---

## §8. Changelog

| Date | Note |
|------|------|
| 2026-05-23 | Scaffold |
| 2026-05-24 | PRD v1.0 |
| 2026-05-25 | SP2 L2: POD + fuel report APIs |
| 2026-05-25 | SW4 L2: trip detail UI, fuel fleet rollup, workflow |
| 2026-05-28 | Enrichment W1: M3, M7, M4 media |
| 2026-05-28 | Enrichment W2: M8–M13 (Gemini logistics ERP) |
