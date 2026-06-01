# ERA Wholesale — Product Requirements Document (PRD)

> B2B опт: заказы, отсрочка, сборка. AR/лимиты/shipment invoice — **Finance**.  
> Entitlement: `industry_wholesale` · Host: `wholesale.era-365.online` (3305)

---

## §1. Vision

Дистрибьюторы принимают заказы в мессенджерах; кредитные лимиты и отгрузки учитываются в ERP с задержкой.

**Решение:** B2B order → pick/pack status → `SATELLITE_WHOLESALE_ORDER_CONFIRMED` → AR invoice + stock reservation in Finance.

**Out-of-scope v1:** WMS robotics, route optimization для доставки last-mile.

---

## §2. Benchmark reference

| Бенчмарк | Что заимствуем |
|----------|----------------|
| **Ordoro** / **Cin7** | B2B order, pick list |
| **SAP B1 wholesale** | Credit limit check (Finance) |
| **1C опт** (CIS) | Заказ → отгрузка → счёт |

---

## §3. Personas & roles

> RBAC: [docs/SATELLITE_DOCUMENTATION.md](../docs/SATELLITE_DOCUMENTATION.md) § Identity & RBAC.

| Роль | Код | Описание |
|------|-----|----------|
| Владелец бизнеса | `BUSINESS_OWNER` | Маппинг `OWNER`/`DIRECTOR`; лимиты — Finance |
| Торговый представитель | `SALES_REP` | B2B заказы |
| Комплектовщик | `WAREHOUSE_PICKER` | Pick list stub |
| Менеджер опта | `WHOLESALE_MANAGER` | Покупатели, прайс |

---

## §4. Modules

| ID | Module | Status | Finance |
|----|--------|--------|---------|
| M0 | Shell | **DONE** | — |
| M1 | B2B order entry | **DONE** | buyerCounterpartyId |
| M2 | Credit limit display | **DONE** | Read Finance AR |
| M3 | Pick/pack workflow | **DONE** | — |
| M4 | Confirm shipment | **DONE** | `ORDER_CONFIRMED` |
| M5 | Delivery note / TTN | **DONE** | Печать отгрузочного документа |
| M6 | Pick wave / route (lite) | **DONE** | Волна сборки склада |
| M7 | EDI / buyer API export | **DONE** | Buyer API |

См. [MODULES_CATALOG](../docs/MODULES_CATALOG.md#industry-module-roadmap) · [PRODUCT_VERSIONING](../docs/PRODUCT_VERSIONING.md).

---

## §5. User stories

| ID | История |
|----|---------|
| W-01 | Создать заказ для контрагента |
| W-02 | Проверить лимит дебиторки (read-only) |
| W-03 | Собрать заказ на складе (status) |
| W-04 | Подтвердить отгрузку → событие |

---

## §6. Integrations

`SATELLITE_WHOLESALE_ORDER_CONFIRMED` — orderId, buyerCounterpartyId, amountNet, lineCount.

---

## §7. Phases

W0 done · W1 order+confirm E2E · W2 pick lists · W3 EDI export

---

## §8. Changelog

2026-05-24 PRD v1.0
2026-05-25 Wave 2 W2: pick list UI + Finance credit fallback
2026-05-28 Gemini enrichment M5–M7 (W2) in §4
