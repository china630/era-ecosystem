# ERA Clinic — Product Requirements Document (PRD)

> Амбулаторная клиника: запись, приём, услуги, лаборатория. Счёт и контрагент-пациент — **Finance**.  
> Entitlement: `industry_clinic` · Host: `clinic.era-365.online` (3306)  
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
| **Full HIS** (OR, MAR, ward pharmacy, DRG/case billing) | Separate product appendix on same satellite — see [ADR clinic-product-lines](../../docs/adr/clinic-product-lines-and-presets.md) Phase 6 |
| HL7/FHIR production, DICOM / PACS | Phase K4+ integrations |
| Национальный e-recept (Dərman) | Регуляторный контур AZ — Phase 3 |
| Полная EMR (долгая история болезни) | Упрощённая карта визита + CPOE lite |
| Страховые ТПА и pre-auth (full) | Finance + модуль договоров §4.15 |
| Склад медикаментов / фармаопт | Finance inventory или retail pharmacy preset — **не** ТТК процедур (см. M3e) |

**In scope (future on same `era-clinic`):** preset **`inpatient_day`** — ward/bed master, ADT-light, daily charges — not full HIS. Current M13 is a **stub** until [CLINIC-FULL-IMPLEMENTATION-PLAN Phase 4](doc/CLINIC-FULL-IMPLEMENTATION-PLAN.md).

---

## §1.4. Product lines & operation presets

Architecture: [ADR clinic-product-lines-and-presets.md](../docs/adr/clinic-product-lines-and-presets.md) · Implementation plan: [doc/CLINIC-FULL-IMPLEMENTATION-PLAN.md](doc/CLINIC-FULL-IMPLEMENTATION-PLAN.md)

| Product line | `Outlet.preset` | Gate | Notes |
|--------------|-----------------|------|-------|
| **ERA Clinic Outpatient** | `outpatient` (default) | `industry_clinic` | Polyclinic, diagnostics — core PRD |
| **ERA Clinic Inpatient Day** | `inpatient_day` | `industry_clinic` + future `clinic_inpatient_day` module | Ward-lite; not full hospital MIS |
| **ERA Sanatorium Clinical** | `sanatorium_clinical` | `industry_clinic` + hotel bundle | Requires `era-hotel-pms` + bus integration |
| **ERA Wellness** | `wellness` | `industry_clinic` | SV8 — scheduling + resources, no EMR |

**Not a separate industry:** there is no `industry_hospital` launcher tile. “Hospital pack” = same satellite + inpatient modules.

**Sanatorium business:** orchestrator entitlements `industry_hotel_pms` + `industry_clinic` (+ optional retail), not a standalone sanatorium satellite.

**Procedure planning:** program/package quotas expand to `PROPOSED` procedure orders on the patient card; the doctor confirms before FIFO placement onto resources (`placeConfirmedProcedures`). See [ADR clinic-doctor-confirmed-fifo-planning](../docs/adr/clinic-doctor-confirmed-fifo-planning.md). Time layers (occupancy vs cabin resource gap vs guest rest vs pair rules): [ADR clinic-scheduling-time-layers](../docs/adr/clinic-scheduling-time-layers.md) — per-type `resourceGapMinutes` / `patientRestMinutes` shipped.

**Physio / sanatorium sites (W2):** doctor picks protocol zones **S** (chips + autocomplete) on the patient card; `ProcedureOrder.sites[]` stores the list; coarse `bodyPart` is derived. Every order still has free-text `note`. Type-gated programs/substances are W3. See [physio-site-canon.md](doc/physio-site-canon.md).

**Code packaging:** domain logic migrates to `era-clinic/src/domain/`; extract to `packages/clinic-domain` only after inpatient ADT API stabilizes (ADR D5).

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
| M0 | Platform shell, SSO | **DONE** | — |
| M1 | Patient registry (ref, не полная EMR) | **SHIPPED** (registry UI) | Counterparty / patient ref sync |
| M2 | Practitioners, rooms, schedule | **SHIPPED** (master-data admin; `staffKind` DOCTOR/NURSE/LAB) | — |
| M3d | Monthly nurse/lab duty roster | **SHIPPED** | Head-doctor matrix `/sanatorium/nurse-roster`; clinic-local absences (Finance HR sync later) |
| M3 | Appointment & check-in | **DONE** | — |
| M3b | Sanatorium nurse day-ops | **SHIPPED** | Check-in → `CHECKED_IN`; auto-complete at `endsAt`; `NO_SHOW` burns quota; event at complete |
| M3e | Procedure TTK (consumable BOM) | **API** | Finance inventory on COMPLETED; ADR clinic-procedure-consumable-ttk; SatAdmin BOM; UAT open |
| M3c | Doctor-confirmed procedure planning | **SHIPPED** | Package/program lines create `PROPOSED` orders; doctor confirms before FIFO resource placement (`placeConfirmedProcedures`); see ADR clinic-doctor-confirmed-fifo-planning |
| M4 | Visit card & clinical services | **DONE** | `VISIT_COMPLETED` |
| M4b | ICD-10 catalog & diagnosis recording | **SHIPPED** | WHO ICD-10 2019 local catalog; sanatorium / visit / inpatient / print; favorites; diagnosis report; orch gateway sync |
| M5 | **Laboratory orders & results** | **DONE** | `LAB_ORDER_COMPLETED`; portal on publish |
| M5 (extend) | **Critical lab result flag** | LIS alert | **DONE** | `enrichResultLines` + `criticalOnly` filter |
| M6 | Service catalog cache (codes, prices) | **DONE** | `ServiceCatalogCache` + sync API |
| M7 | Notifications (SMS/email stub) | **DEFERRED** | Использовать `platform_notifications` |
| M8 | Patient portal (results, booking) | **DONE** | `/portal` + session API |
| M9 | Multi-room drag reschedule | **DONE** | Reschedule API |
| M10 | EHR templates / CPOE lite | **DONE** | ERPs/07 §2 |
| M11 | LIS analyzer import (HL7/file) | **DONE** | ERPs/07 §3 |
| M12 | Insurance / DMS eligibility | **DONE** | **Finance** §4.15 |
| M13 | Inpatient / bed management (ADT-light) | **SHIPPED** | ERPs/07 §7; preset `inpatient_day` |
| M14 | Telehealth + patient portal | **DONE** | **PLATFORM** portal |

См. [MODULES_CATALOG § roadmap](../docs/MODULES_CATALOG.md#industry-module-roadmap) · [PRODUCT_VERSIONING](../docs/PRODUCT_VERSIONING.md).

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
| K-12 | Справочник услуг и анализов (кэш) | Синхронизация кодов с Finance price list; стандартные шаблоны исследований/анализов — [DIAGNOSTIC_AND_LAB_CATALOG](./doc/DIAGNOSTIC_AND_LAB_CATALOG.md) |
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
| 2026-07-21 | CLI-32: diagnostic catalog in DB + LabOrderItem/LabResult; /lab-orders table registry |
| 2026-07-22 | CLI-33: cashier ops — queue, shifts X/Z, multi-channel settle, over-quota |
| 2026-07-22 | CLI-05: `/appointments` practitioner day matrix; legacy `/scheduling` + `/api/scheduling/slots` + `getAvailableSlots` removed (no redirect) |
| 2026-07-22 | CLI-37: global instant filters (`EraListFilterBar`); clinic home shared date + full width; name-first tables + icon actions |
| 2026-05-25 | SP2: lab orders UI + scheduling slots stub API |
| 2026-05-25 | SW3/K2-K3: full lab lifecycle, discount audit, executive summary |
| 2026-05-28 | Enrichment W1: M5 critical flag, M6 price cache |
| 2026-06-16 | §1.4 product lines & presets; out-of-scope clarified (full HIS vs inpatient_day); M13 → PARTIAL |
| 2026-07-14 | Standard diagnostic + lab template catalog (USG/CT/ECG/panels) — seed JSON + K-12 link |
| 2026-07-14 | Catalog v1.1 P0+P1: 85 studies, 45 lab panels, 13 visits, 7 packages |
| 2026-08-24 | Catalog v1.2 lab: 48 panels, ~362 analytes (MediClub/Exonlab/Nafta routine); smear + biochem-ext + celiac |
| 2026-08-18 | CLI-39…42: WHO ICD-10 catalog + diagnosis recording (sanatorium/visit/inpatient/print/favorites/report + orch gateway) |


### 2026-07-22 — CLI-34 print forms

Trilingual print routes (lab/USM/checkup/procedures), tenant branding, qualitative analyte options, ImagingPhrase library, PrintLanguageDialog on patient card and lab workflow.

### 2026-07-22 — CLI-35 sidebar cleanup

Setup group split into **Catalogs** and **Rules & data**; `/admin/wards` moved under the Inpatient module (admin-only, URL unchanged); `/executive` merged into Home `/` as the first block for owners (`canViewExecutive`) and the standalone route deleted; `/admin/catalog-favorites` merged into a **Favorites** tab on `/admin/diagnostic-catalog` and the standalone route deleted; catalog labels disambiguated (Service prices vs Diagnostic catalog).

### 2026-07-22 — CLI-36 practitioner shift rotation

Doctors in private clinics rotate shifts. New rule-based shift engine
(`PractitionerScheduleRule` + `PractitionerScheduleException`) supporting weekly,
even/odd week, even/odd day-of-month and arbitrary N-day cycle patterns, each with
its own working hours, plus date exceptions (day off / extra shift / custom hours).
The `/appointments` matrix blocks off-shift slots and appointment create/reschedule
reject off-shift bookings. Managed via the **Shifts** modal on `/admin/master-data`.
Practitioners with no rules stay unrestricted (back-compatible). See ADR
`docs/adr/clinic-practitioner-shifts.md`.

### 2026-07-22 — CLI-37 UI list/filter standard

Global `EraListFilterBar`: instant apply (no Apply button), Reset on the same row as
fields, text search via `useDebouncedValue` (300ms). Clinic home is full-width with one
shared date for executive + ops dashboards. List/admin tables: name/title column first;
row actions are Lucide icons + `TABLE_ROW_ICON_BTN_CLASS`.
