# ERA Clinic — Product Requirements Document (PRD)

> Амбулаторная клиника: запись, приём, услуги, лаборатория. Счёт и контрагент-пациент — **Finance**.  
> Entitlement: `industry_clinic` · Host: `clinic.era.az` (3306)  
> TZ: [TZ.md](./TZ.md) · DELIVERY: [doc/DELIVERY-CLINIC.md](./doc/DELIVERY-CLINIC.md)

| Параметр | Значение |
|----------|----------|
| **Продукт** | ERA Clinic (`era-clinic`) |
| **События** | `SATELLITE_CLINIC_VISIT_COMPLETED`, `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` (K2+) |

---

## §1. Vision

### 1.1. Проблема

Частные клиники ведут запись в Excel/WhatsApp; результаты анализов — в отдельных PDF от лаборатории; выручка по приёму и лаборатории не консолидируется в ERP; нет единой картины для владельца сети клиник.

### 1.2. Решение

Операционная МИС-lite: расписание → визит → услуги и заказы анализов → события в Finance → счёт и дебиторка. Владелец видит KPI через SSO (`BUSINESS_OWNER`).

### 1.3. Out-of-scope (явно)

| Область | Почему не v1 |
|---------|----------------|
| Стационар, палаты, операционная | Отдельный продукт / гос. МИС |
| HL7/FHIR, LIS, DICOM | Phase K4+ интеграции |
| Национальный e-recept (Dərman) | Регуляторный контур AZ — Phase 3 |
| Полная EMR (история болезни, ICD-10 coding) | Упрощённая карта визита |
| Страховые ТПА и pre-auth | Finance + модуль договоров §4.15 |
| Склад медикаментов / фармаопт | Finance inventory или отдельный модуль |

---

## §2. Benchmark reference

| Бенчмарк | Что заимствуем |
|----------|----------------|
| **Medesk** | Расписание, карточка пациента, напоминания |
| **Cliniko** | Простой practice management, услуги по прайсу |
| **DocPlanner** | Онлайн-запись (Phase K3) |
| **1C:Медицина** | Услуги → счёт; лаборатория как отдельный контур |
| **Local AZ labs** | PDF/Excel результат, ручной импорт в v1 |

---

## §3. Personas & roles

> RBAC control plane: [docs/SATELLITE_DOCUMENTATION.md](../docs/SATELLITE_DOCUMENTATION.md) § Identity & RBAC.

| Роль | Код | Описание |
|------|-----|----------|
| Владелец бизнеса | `BUSINESS_OWNER` | Маппинг `OWNER`/`DIRECTOR` из orchestrator: KPI, тарифы, пользователи — Finance; в клинике — сводка выручки, утверждение скидок |
| Администратор клиники | `CLINIC_ADMIN` | Прайс-линки, кабинеты, врачи, настройки расписания |
| Регистратура | `RECEPTION` | Запись, check-in, оплата на месте (stub), печать направления на анализы |
| Врач | `DOCTOR` | Приём, услуги, назначение анализов, закрытие визита |
| Медсестра / процедурный | `NURSE` | Забор материала, статус «в работе» по заказу лаборатории |
| Лаборант (внутр.) | `LAB_TECH` | Ввод/импорт результатов, публикация пациенту |
| Аудитор (SSO) | `SATELLITE_OPERATOR` | Read-only через SSO |

---

## §4. Modules

| ID | Module | Status | Finance |
|----|--------|--------|---------|
| M0 | Platform shell, SSO | **MVP** | — |
| M1 | Patient registry (ref, не полная EMR) | **PLANNED** | Counterparty / patient ref sync |
| M2 | Practitioners, rooms, schedule | **PLANNED** | — |
| M3 | Appointment & check-in | **PLANNED** | — |
| M4 | Visit card & clinical services | **PLANNED** | `VISIT_COMPLETED` |
| M5 | **Laboratory orders & results** | **MVP** | `LAB_ORDER_COMPLETED`; portal on publish |
| M5 (extend) | **Critical lab result flag** | LIS alert | **MVP** | `enrichResultLines` + `criticalOnly` filter |
| M6 | Service catalog cache (codes, prices) | **MVP** | `ServiceCatalogCache` + sync API |
| M7 | Notifications (SMS/email stub) | **DEFERRED** | Использовать `platform_notifications` |
| M8 | Patient portal (results, booking) | **DEFERRED** | `platform_portal` + K4 |
| M9 | Multi-room drag reschedule | **W2 PLANNED** | K3; Gemini 07 §1 |
| M10 | EHR templates / CPOE lite | **W2 DEFERRED** | Gemini 07 §2 |
| M11 | LIS analyzer import (HL7/file) | **W2 DEFERRED** | Gemini 07 §3 |
| M12 | Insurance / DMS eligibility | **W2 DEFERRED** | **Finance** §4.15 |
| M13 | Inpatient / bed management | **W2 DEFERRED** | Gemini 07 §7 |
| M14 | Telehealth + patient portal | **W2 PLANNED** | **PLATFORM** portal |

См. [MODULES_CATALOG § enrichment](../docs/MODULES_CATALOG.md#industry-enrichment-backlog-gemini-erp--era).

---

## §5. User stories

### Расписание и приём

| ID | История | Критерий приёмки |
|----|---------|------------------|
| K-01 | Записать пациента на слот | Слот занят; конфликт врача/кабинета — ошибка |
| K-02 | Check-in на ресепшене | Статус `CHECKED_IN` → врач видит очередь |
| K-03 | Провести приём, выбрать услуги | Строки визита с кодами из M6 |
| K-04 | Закрыть визит | Событие `SATELLITE_CLINIC_VISIT_COMPLETED` с `serviceCodes[]`, `amountNet` |
| K-05 | Расписание врача на день | Фильтр по `practitionerId`, drag reschedule (K2) |

### Лаборатория

| ID | История | Критерий приёмки |
|----|---------|------------------|
| K-06 | Назначить панель анализов с приёма | `LabOrder` linked to `visitId`, статус `ORDERED` |
| K-07 | Напечатать/отправить направление | PDF/barcode stub с `orderId` |
| K-08 | Отметить забор материала | Статус `COLLECTED`, `collectedAt` |
| K-09 | Импортировать результат (PDF/ручной ввод) | Статус `RESULT_READY`, значения по позициям |
| K-10 | Опубликовать результат врачу/ресепшену | Статус `PUBLISHED`; врач видит в карте визита |
| K-11 | Закрыть заказ лаборатории для биллинга | Событие `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` или включение в визит |

### Администрирование

| ID | История | Критерий |
|----|---------|----------|
| K-12 | Справочник услуг и анализов (кэш) | Синхронизация кодов с Finance price list |
| K-13 | Скидка на визит | Только `CLINIC_ADMIN` / `BUSINESS_OWNER`; audit log |
| K-14 | Сводка выручки за день | `BUSINESS_OWNER`: visits + lab, без GL в спутнике |
| K-15 | Отмена визита с причиной | До закрытия — без события; после — void flow в Finance (ручной) |

---

## §6. Integrations

### Finance

| Event | Когда | Payload |
|-------|-------|---------|
| `SATELLITE_CLINIC_VISIT_COMPLETED` | Закрыт визит с услугами | `visitId`, `patientRef`, `serviceCodes[]`, `amountNet`, `currency: AZN` |
| `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` | K2: отдельный биллинг лаборатории | `orderId`, `visitId?`, `patientRef`, `testCodes[]`, `amountNet` |

Finance: счёт, контрагент, опционально договор с лабораторией (**§4.15** Contract Management).

### Orchestrator

SSO + RBAC claims; публикация событий через `@era/satellite-kit` gateway.

### External (deferred)

| Система | Phase |
|---------|-------|
| LIS / HL7 | K4 |
| DocPlanner API | K3 |
| DICOM / PACS | out of scope |

---

## §7. Release phases

| Phase | Scope |
|-------|--------|
| **K0** | Scaffold, SSO, health (**done**) |
| **K1** | M1–M4: patient ref, schedule, visit, `VISIT_COMPLETED` E2E |
| **K2** | M5: lab order lifecycle K-06…K-11, `LAB_ORDER_COMPLETED` |
| **K3** | Multi-doctor rooms, online booking stub, discount K-13 |
| **K4** | LIS file drop, patient portal M8 |

---

## §8. Finance boundary

| Satellite | Finance |
|-----------|---------|
| Расписание, визит, назначение анализов, PDF результата | GL, AR invoice, patient/counterparty MDM |
| `patientRef` (opaque id) | Полные PII и договор при необходимости |
| Прайс услуг/анализов (кэш) | Master price list, НДС |

См. [doc/clone-spec/01-finance-boundary.md](./doc/clone-spec/01-finance-boundary.md).

---

## §9. Changelog

| Date | Note |
|------|------|
| 2026-05-24 | PRD v1.0 |
| 2026-05-24 | v1.1: M5 lab, personas, BUSINESS_OWNER, расширенные stories K-06…K-15 |
| 2026-05-25 | SP2: lab orders UI + scheduling slots stub API |
| 2026-05-25 | SW3/K2-K3: full lab lifecycle, discount audit, executive summary |
| 2026-05-28 | Enrichment W1: M5 critical flag, M6 price cache |
| 2026-05-28 | Enrichment W2: M9–M14 (Gemini medical ERP) |
