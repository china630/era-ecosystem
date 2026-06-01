# ERA Hotel PMS — Product Requirements Document (PRD)

> Property Management System для отелей и санаториев (пилот Nafta).  
> **Детальная спецификация:** [doc/clone-spec/README.md](./doc/clone-spec/README.md) · Трекинг: [doc/DELIVERY.md](./doc/DELIVERY.md)

| Параметр | Значение |
|----------|----------|
| **Продукт** | ERA Hotel PMS (`era-hotel-pms`) |
| **Host** | `hotel-pms.era-365.online` (3000) |
| **Статус** | Phase 1–2 largely **DONE** (see DELIVERY) |

---

## §1. Vision

### 1.1. Проблема

Отелям нужен локализованный PMS (AZ/RU) с folio, night audit, channel stub и интеграцией в ERP — без турецкого vendor lock-in.

### 1.2. Решение

Cloud PMS: бронь, шахматка, folio, HK, medical, ERP bridge, POS bridge для **era-fnb-pos**.

### 1.3. Связанные продукты

| Продукт | Связь |
|---------|-------|
| **era-fnb-pos** | Room charge, POS shift → NA block |
| **era-finance-core** | E1/E2/E5/E6, GL, tourism registry |
| **era-orchestrator** | SSO, satellite events |

---

## §2. Benchmark reference

| Бенчмарк | Что заимствуем |
|----------|----------------|
| **Opera Cloud** | Folio, NA, enterprise flows |
| **Mews** | Modern UX patterns |
| **ElektraWeb** | AZ market parity, screen traceability ([doc/clone-spec/11](./doc/clone-spec/11-screen-traceability.md)) |

---

## §3. Personas

| Роль | Код | Примечание |
|------|-----|------------|
| Владелец бизнеса | `BUSINESS_OWNER` | Маппинг `OWNER`/`DIRECTOR` из control plane — [SATELLITE_DOCUMENTATION.md](../docs/SATELLITE_DOCUMENTATION.md) |
| Операционные роли | см. clone-spec | Receptionist, Night auditor, HK, Manager — [doc/clone-spec/02-roles-and-processes.md](./doc/clone-spec/02-roles-and-processes.md) |
| Аудитор (SSO) | `SATELLITE_OPERATOR` | Read-only |

---

## §4. Feature areas

### Core (delivered)

| Feature area | Scope | Status | Doc |
|--------------|-------|--------|-----|
| **PMS Core** | Book, folio, NA, HK, channel stub | **DONE** | DELIVERY Stages 1–4 |
| **ERP / satellite events** | Outbound integration | **DONE** | Stage 10–12 |
| **Medical / sanatorium scheduling** | Procedures, sanatorium | **DONE** | `/procedures`, `/medical` |
| **Banquets BEO** | Event orders | **DONE** | `/banquets` |
| **Stock MVP** | Hotel stock catalog | **DONE** | `/admin/stock` |
| **Agency / invoices read** | Reports → Finance | **DONE** | reports |
| **POS bridge (F&B)** | Room charge, calendar | **DONE** | Stage 17 |
| **Yield management** | Dynamic BAR | **DONE** | contract pricing |
| **Guest loyalty tiers** | Platform hook | **DONE** | `platform_loyalty` |
| **Room service QR** | fb-pos bridge | **DONE** | SATELLITE + fnb-pos |
| **Maintenance work orders** | Ops | **DONE** | SATELLITE |

Commercial submodule keys: see [`docs/adr/hotel-module-taxonomy.md`](../docs/adr/hotel-module-taxonomy.md) and [`doc/ELEKTRAWEB-PARITY.md`](./doc/ELEKTRAWEB-PARITY.md).

Full checklist: [doc/DELIVERY.md](./doc/DELIVERY.md)

### Internal traceability (appendix — not for UI)

| Legacy ID | Maps to feature area above |
|-----------|----------------------------|
| M1–M10 | PMS Core |
| M11 | ERP / satellite events |
| M12–M17 | Medical, banquets, stock, agency, POS bridge |
| M20–M23 | Yield, loyalty hook, room-service QR, maintenance WO |

---

## §5. User stories

Index: [doc/clone-spec/12-user-stories-index.md](./doc/clone-spec/12-user-stories-index.md)  
Must stories for UAT: [doc/clone-spec/13-nafta-validation-checklist.md](./doc/clone-spec/13-nafta-validation-checklist.md)

---

## §6. Integrations

| Direction | Protocol |
|-----------|----------|
| Outbound ERP | E1/E2/E5/E6, OpenAPI in `doc/openapi/` |
| Inbound ERP | E6 webhook |
| fnb-pos | [fnb-pos-pms-bridge.yaml](./doc/openapi/fnb-pos-pms-bridge.yaml) |
| Orchestrator | `SATELLITE_HOTEL_*` events |

---

## §7. Release phases

| Phase | Scope |
|-------|--------|
| Phase 1 | MVP PMS (DELIVERY Stages 0–11) — **done** |
| Phase 2 | ERP, AZ compliance, POS bridge — **done** |
| Phase 2+ | B2C, HK mobile, drag room plan — backlog |

---

## §8. Changelog

| Date | Note |
|------|------|
| 2026-05 | Phase 1–2 delivery |
| 2026-05-28 | §4 module IDs M1–M23; W2 enrichment M20–M23 |
| 2026-05-24 | Formal PRD.md (umbrella index to clone-spec) |
