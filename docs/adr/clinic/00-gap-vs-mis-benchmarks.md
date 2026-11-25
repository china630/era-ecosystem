<!-- Split from medical-satellite-gap-analysis.md. Index: ./README.md -->

# ERA Clinic (медицинский сателлит): gap-анализ и план доработок

> **Для Cursor.** Это рабочее ТЗ на доработку `era-clinic`. Каждый пункт плана (раздел 7) содержит приоритет, оценку, конкретные файлы/модели и критерии приёмки. Перед реализацией каждого пункта сверяйся с указанными ADR и с правилами репозитория (`.cursor/rules/era-coverage-definition.mdc`: строка в `docs/COVERAGE_MATRIX.md` + тег в `era-clinic/doc/DELIVERY-CLINIC.md` + путь в `era-clinic/doc/UAT-SMOKE.md`).
>
> Дата анализа: 2026-11-25. Код изучен **только на чтение** (`D:\My Projects\era-ecosystem`). Утверждения о нашем коде даны со ссылками на файлы; утверждения о конкурентах — со ссылками на источники (раздел 9). Где факт не подтверждён, это написано явно.

---

## 0. TL;DR

1. **Один сателлит, четыре пресета.** Клиника, больница и санаторий — это не разные продукты, а `era-clinic` + `Tenant.enabledPresets` (`outpatient`, `inpatient_day`, `sanatorium_clinical`, `wellness`) + модульные ключи `clinic_*` (`packages/satellite-kit/src/integration/clinic-module-keys.ts`). Канон: `docs/adr/clinic/clinic-product-lines-and-presets.md`.
2. **Санаторий действительно сильный** — и по глубине планировщика процедур (квоты пакетов, FIFO после подтверждения врача, слоты 5 мин, перерывы кабинета/отдых гостя, ротации/замены, графики дежурств, ванные серии, зоны физиотерапии, групповые walk-in, мост с отелем) он **сильнее** 1С:Санаторий/ХИТ/Bnovo в части медицины. Слабее — в диетпитании, «браслетах», витринах продажи путёвок и в том, что половина свежих волн (CLI-55/57/58/62) ещё в статусе **SCREEN**, а не SHIPPED.
3. **Клиника (amb.) — MIS-lite с дырами в ядре врача.** Нет протокола приёма (жалобы/анамнез/объективно/план как структурированная запись), рабочее место врача — просто список, онлайн-запись без поиска свободных слотов и выключена в проде по умолчанию, напоминания — один WhatsApp-шаблон с UTC-временем, портал пациента — поле «вставь токен» и сырой JSON, телемедицины нет (есть только ключ модуля), страховка — `window.prompt` + сырой JSON. По сравнению с MEDODS/Medesk/Cliniko это главный разрыв для продаж.
4. **Больница — заглушка уровня «койко-место».** Есть палаты/койки, admit/transfer/discharge и ночное начисление за койко-день. Нет приёмного отделения, лечащего врача, дневников, листа назначений (MAR), температурного листа/витальных, сестринского поста, выписного эпикриза, операционной, диет. По сравнению с Медиалог/Damumed/Epic — это не стационар, а учёт коек.
5. **Документация опережает код.** PRD помечает M8 (портал), M12 (страховка), M13 (стационар), M14 (телемедицина) как DONE/SHIPPED, хотя в коде это прототипы/заглушки (детали — раздел 3). Это риск для продаж и для Cursor (он будет считать функции готовыми).
6. **Азербайджан.** Для работы с İcbari Tibbi Sığorta (İTS) и TƏBİB частной клинике нужны: приём электронных направлений (göndəriş) из e-Tabib, отчётность об оказанных услугах для возмещения, ICD-10, совместимость с «Rəqəmsal resept» / e-Epikriz / e-Bülleten. Публичного API для частных МИС мы не нашли — закладываем **адаптерный слой + ручной режим** (раздел 6).
7. **Порядок работ:** P0 — «врачебное ядро» амбулатории (протокол приёма, рабочее место врача, онлайн-запись со слотами, напоминания), «стационар-MVP» (приёмное, лечащий врач, дневник, лист назначений, витальные, эпикриз), честные статусы в документации и мелкие баги. P1 — портал, телемедицина, страховка/İTS, рецепты со справочником, анкеты/согласия, планы лечения, диеты, вывод санаторных волн в SHIPPED. P2 — операционная, eMAR со штрих-кодом, DRG, wellness-пресет, мобильное приложение.

---

## 1. Где что лежит

| Что | Путь |
|---|---|
| Сателлит | `D:\My Projects\era-ecosystem\era-clinic` (Next.js 15 UI в `app/`, API — Nest native controllers в `nest/native/controllers`, доменная логика в `src/domain/*`, Prisma `prisma/schema.prisma` — 102 модели, 141 миграция) |
| PRD / TZ | `era-clinic/PRD.md`, `era-clinic/TZ.md` |
| План / архитектура / delivery | `era-clinic/doc/CLINIC-FULL-IMPLEMENTATION-PLAN.md`, `era-clinic/doc/ARCHITECTURE.md`, `era-clinic/doc/DELIVERY-CLINIC.md`, `era-clinic/doc/UAT-SMOKE.md` |
| ADR клиники (≈33 файла `clinic-*.md`) + санаторий | `D:\My Projects\era-ecosystem\docs\adr\` (ключевые: `clinic-product-lines-and-presets.md`, `clinic-episode-as-clinical-course.md`, `sanatorium-vnext.md`, `clinic-doctor-confirmed-fifo-planning.md`, `clinic-scheduling-time-layers.md`, `clinic-episode-procedure-assign-modal.md`, `clinic-domain-permissions-and-rbac.md`) |
| Статусы возможностей | `docs/COVERAGE_MATRIX.md` (строки `CLI-01…CLI-64`) |
| Edition | `docs/editions/clinic.yaml` → `status: mvp`, `pilot_ready: false`, `notes: "Nafta lab; fiscal/HL7 STUB; field sign-off open"` |
| Модульные ключи и роутинг модулей | `packages/satellite-kit/src/integration/clinic-module-keys.ts` |
| Пресеты и гейтинг путей | `era-clinic/src/domain/presets/clinic-presets.ts`, `preset-cookie.ts`, `era-clinic/middleware.ts` |
| Санаторная часть в отеле | `era-hotel-pms/prisma/schema.prisma` (`RatePlanPackageLine`, `MedicalAlert`, `MedicalOrder`, `LabResult`, `MedicalProcedure`, `ProcedureService`, `ProcedureAppointment`, `SpaPlace`) |
| **Этот файл** | `docs/adr/clinic/00-gap-vs-mis-benchmarks.md` (рядом с ADR клиники) |

---

## 2. Как устроены «бандлы» (по коду)

| Бандл (как продаём) | Пресет `Tenant.enabledPresets` | Модули `clinic_*` | Что открывает (по `presetsRequiredForPath`) |
|---|---|---|---|
| **Клиника (амбулатория)** | `outpatient` (дефолт) | `clinic_registry_emr`, `clinic_lab`, опц. `clinic_telehealth`, `clinic_insurance`, `platform_portal`, `platform_notifications` | `/appointments`, `/reception/queue`, `/cashier`, `/doctor`, `/visits/*`, `/lab-orders`, `/patients` |
| **Больница (стационар-lite)** | `inpatient_day` | `clinic_inpatient` | `/inpatient`, `/inpatient/census`, `/admin/wards` |
| **Санаторий** | `sanatorium_clinical` + отель (`industry_hotel_pms` + `hotel_medical_sanatorium`) | `clinic_sanatorium`, `clinic_nurse_roster` | `/sanatorium/*`, `/nurse`, `/check-in`, `/reception/extra-tickets`, `/reports/*` (процедуры, бонусы, выручка), `/admin/program-templates`, `/admin/procedure-rules`, `/admin/physio-sites`, `/admin/import` |
| Wellness | `wellness` | — | **Ничего**: в `clinic-presets.ts` нет ни одного пути, гейтящегося `wellness` → пресет объявлен, но не подключён |

Отдельного `industry_hospital` нет и не планируется (ADR `clinic-product-lines-and-presets.md`, D1). «ERA Hospital» = `industry_clinic` + inpatient pack.

---

## 3. Карта зрелости: документация vs код

Легенда: ✅ сделано и подтверждено кодом · 🟡 частично / прототип · 🔴 заглушка или нет · ⚠️ расхождение с документацией.

### 3.1. Общие и амбулаторные модули

| Модуль (PRD §4) | Статус в PRD | Факт в коде | Доказательство |
|---|---|---|---|
| M0 SSO/shell | DONE | ✅ | `nest/native/controllers/auth_*`, `@era/satellite-kit` |
| M1 Реестр пациентов | SHIPPED | ✅ реестр, MDM-идентификаторы, эпизоды-курсы | `PatientRef`, `nest/native/controllers/patients*.ts`, `mdm_person-*.ts`, `app/patients/*` |
| M2 Врачи/кабинеты/ресурсы, смены | SHIPPED | ✅ + движок ротаций смен (CLI-36) | `Practitioner`, `PractitionerScheduleRule/Exception`, `Room`, `Resource` |
| M3 Запись и check-in | DONE | ✅ матрица дня врача, перенос, отмена, check-in | `Appointment`, `appointments_calendar.ts`, `appointments__id_*.ts`, `app/appointments` |
| M4 Визит и услуги | DONE | 🟡 визит = строки услуг + МКБ + CPOE-шаблоны **диагностики**. **Нет структурированного протокола осмотра** (жалобы/анамнез/объективно/план/рекомендации). Кнопка «Завершить» в UI показывается только для `IN_HOUSE` (`canComplete` в `app/visits/[id]/page.tsx`); для `WALK_IN` завершение идёт другим путём (касса) — нужно проверить и сделать явным | `Visit`, `VisitServiceLine`, `CpoeEntry.payloadJson`, `src/domain/cpoe/cpoe-payload.ts`, `src/components/VisitCpoePanel.tsx` |
| Рабочее место врача | — | 🔴 `/doctor` — список визитов `IN_PROGRESS`/`CHECKED_IN` из `/api/appointments` без расписания, очереди, истории, поиска | `app/doctor/page.tsx` (2,6 КБ) |
| M4b МКБ-10 | SHIPPED | ✅ WHO 2019 + RU + AZ XBT-10 через gateway, избранное, отчёт | `IcdCode`, `VisitDiagnosis`, `AdmissionDiagnosis`, `CLI-39…42` |
| M5 Лаборатория | DONE | ✅ сильный контур: каталог 85 исследований/48 панелей/~362 аналита, жизненный цикл, критические флаги, бланки Word, печать на 3 языках | `LabOrder`, `LabOrderItem`, `LabResult`, `DiagnosticService`, `AnalyteDictionary`, `CLI-12/32/34/60` |
| M6 Каталог услуг/цен | DONE | ✅ | `ServiceCatalogCache`, `ServiceCatalogPrice` |
| M7 Уведомления | DEFERRED | 🟡 есть cron напоминаний за 24 ч, **один** канал WhatsApp, хардкод-текст на русском, время в **ISO UTC** (`appt.scheduledAt.toISOString()`), нет подтверждения/отмены ответом, нет истории в карточке | `src/domain/appointment/appointment-calendar.service.ts` (`processAppointmentRemindersForOrganization`), `nest/native/controllers/cron_appointment-reminders.controller.ts` |
| M8 Портал пациента | DONE ⚠️ | 🔴 страница `/portal`: поле «вставьте токен» → сырой `JSON.stringify` ответа; API отдаёт **только** опубликованные лаб-результаты. Записи, визитов, документов, оплаты нет | `app/portal/page.tsx`, `nest/native/controllers/portal_session.controller.ts` |
| Онлайн-запись | K3 «stub» | 🟡 `POST /api/booking/appointments` создаёт запись по `practitionerCode` (дефолт `GP-01`), **без API свободных слотов** (`getAvailableSlots` удалён в CLI-05), в проде выключено, если не `CLINIC_PUBLIC_BOOKING_ENABLED=true`; виджета нет | `nest/native/controllers/booking_appointments.controller.ts`, `app/booking/page.tsx` (1,8 КБ) |
| M9 Перенос drag | DONE | ✅ | `appointments__id_reschedule.ts` |
| M10 EHR-шаблоны / CPOE-lite | DONE | 🟡 шаблоны = формы результатов диагностических услуг (USG/ECG и т. п.), а не шаблоны врачебного осмотра | `src/domain/cpoe/cpoe-payload.ts` |
| M11 LIS импорт | DONE ⚠️ | 🟡 файловый импорт CSV по профилю — да; **HL7 — STUB** (`COVERAGE_MATRIX` CLI-23), PRD §6 одновременно пишет «LIS/HL7 — K4 deferred» | `LisFileProfile`, `lab_import.ts`, `lab-orders_import.ts` |
| M12 Страховка/ДМС | DONE ⚠️ | 🟡 прокси `financeEligibilityCheck` в Finance; UI: `window.prompt("FIN")` + вывод сырого JSON. Нет полиса на пациенте, договоров со страховыми, лимитов, гарантийных писем, реестров | `nest/native/controllers/insurance_check.controller.ts`, `app/visits/[id]/page.tsx` (`checkInsurance`) |
| M13 Стационар ADT-light | SHIPPED ⚠️ (в changelog — PARTIAL, в ADR — «stub») | 🟡 см. 3.2 | — |
| M14 Телемедицина + портал | DONE ⚠️ | 🔴 есть ключ модуля `clinic_telehealth` и маршрут `/telehealth` в `CLINIC_MODULE_BY_ROUTE`, но **страницы `app/telehealth` нет**; единственный след — поле `telehealthUrl` при публикации лаб-заказа | `clinic-module-keys.ts`, `src/domain/lab/lab-order-write.service.ts` (`markLabOrderPublished`) |
| Рецепты | — | 🟡 `POST /api/visits/:id/prescription`: свободный `sku` (без справочника лекарств, дозировок, кратности), отправка в очередь аптеки `era-retail-pos`. **Баг:** `prescriptionQueueId` берётся из `httpReq.body`, а не из ответа retail → всегда `null` | `nest/native/controllers/visits__id_prescription.controller.ts` |
| Очередь регистратуры | SHIPPED | ✅ | `QueueTicket`, `queue_*.ts`, `app/reception/queue` |
| Касса, смены X/Z, мульти-оплата | SHIPPED | ✅ (фискализация NBC — STUB, CLI-24) | `ClinicShift`, `ClinicReceipt*`, `cashier_*.ts` |
| Отчёты | — | ✅ выручка, диагнозы, процедуры, бонусы врачей, по странам | `app/reports/*` |
| Аудит, RBAC | SHIPPED | ✅ Layer A/B аудит, роли и права из БД | `SatelliteAuditLog`, `Role`, `clinic-role-permissions.defaults.json`, ADR `clinic-domain-permissions-and-rbac.md` |
| Лист ожидания, повторяющиеся записи, анкеты/согласия, ДР-поздравления, отзывы | — | 🔴 не найдено (`consent`, `recurring`, `prepay`, `birthday` — 0 совпадений в `src/`, `nest/`, `app/`) | grep по коду |

### 3.2. Стационар (`inpatient_day`)

| Что | Факт | Доказательство |
|---|---|---|
| Палаты/койки CRUD | ✅ | `Ward`, `Bed` (`status` — **строка**, не enum), `admin_wards*.ts`, `app/admin/wards` |
| Поступление/перевод/выписка | 🟡 есть, но минимально: `admitPatient(patientRefId, bedId)`; `transferAdmission` ставит `TRANSFERRED` и тут же обратно `ADMITTED` (история переводов только через `BedAssignment`) | `src/domain/inpatient/adt.service.ts` |
| Койко-день | ✅ cron `inpatient-daily-charges` → `InpatientDailyCharge` (уникально по дате) | `src/domain/inpatient/daily-charge.service.ts` |
| Диагнозы при поступлении | ✅ `AdmissionDiagnosis` | CLI-40 |
| Census / доска палат | ✅ | `app/inpatient`, `app/inpatient/census` |
| Приёмное отделение (жалобы, осмотр, решение «госпитализировать/отказ», источник поступления, экстренно/планово) | 🔴 | `InpatientAdmission` — только `status`, `admittedAt`, `dischargedAt` |
| Лечащий врач, отделение, профиль койки | 🔴 | нет полей |
| Дневники, этапные эпикризы, консилиумы | 🔴 | нет моделей |
| Лист назначений (лекарства: доза, путь, кратность, отметки выполнения), MAR | 🔴 | нет моделей `Medication*` |
| Температурный лист / витальные / шкалы (Морсе, Ватерлоу, боль) | 🔴 | нет моделей `Vital*` |
| Сестринский пост (задачи по времени) | 🔴 для стационара (есть только санаторный `/nurse`) | — |
| Выписной эпикриз + печать | 🔴 | нет `discharge summary` в коде (grep `epicris|discharge summary` = 0) |
| Операционная, анестезия, реанимация | 🔴 | — |
| Диетпитание | 🔴 (в клинике 0 упоминаний diet; в отеле есть только `MealPlan` как тариф питания) | `era-hotel-pms/prisma/schema.prisma` |
| Выбор пациента при поступлении | 🟡 UI грузит `/api/patients?pageSize=100` — не масштабируется | `app/inpatient/page.tsx` |

### 3.3. Санаторий (`sanatorium_clinical`) — что подтверждено кодом

- Эпизод-курс на гостя (`ClinicalEpisode`, open/close из отеля, per-pax), анамнез/жалобы/МКБ/противопоказания на курсе; гейты `ANAMNESIS_REQUIRED` и т. д. (ADR `clinic-episode-as-clinical-course.md`, CLI-55 — **SCREEN**).
- Программы и пакеты: `ProgramTemplate*`, `ProgramInstance`, `ProgramProcedureBalance`, `ProgramQuotaTransfer`, узлы квот PDF, интерполяция по ночам (CLI-51), замены/перенос/корректировка в модалке (`sanatorium_episodes__id_package-assign_*.ts`).
- Планирование: `PROPOSED` → подтверждение врачом → FIFO-раскладка (`placeConfirmedProcedures`), ротации (`ProcedureRotationRule`), замены (`ProcedureSubstitutionRule`), совместимость (`ProcedureCompatibilityRule`), последовательности (`ProcedureRule`), пиковые дни (`ClinicPeakRule`), календарь клиники (`ClinicDayOverride`), три временных слоя (занятость / перерыв кабинета / отдых гостя), открытая явка (CLI-62, SCREEN), ванные серии (CLI-58, SCREEN).
- Ресурсы и люди: `Resource`, `ResourceBooking`, `ProcedureAllocation`, требования к типу процедуры, навыки, `StaffDutyRoster` (месячные графики), подмены на день, отсутствия.
- День процедур: QR-check-in медсестрой, окна check-in, авто-завершение, NO_SHOW сжигает квоту, доска медсестры, печать листов.
- Физиотерапия: каталог зон S, `ProcedureOrderSite`, очередь несопоставленных «nahiye».
- Деньги: сверхквотные/платные extras, тикеты, сторно, бонус врача, выручка по revenue-кодам отеля, outbox расходников (`ConsumptionOutbox`), ТТК расходников (`ProcedureConsumableLine`).
- Интеграция с отелем: `from-stay`, lifecycle outbox, capacity foresight, walk-in группы в корзину кассы отеля.
- Слабое место архитектуры: в `era-hotel-pms` остаётся **дублирующий мини-медконтур** (`MedicalAlert`, `MedicalOrder`, `LabResult`, `MedicalProcedure`, `ProcedureAppointment`) — ADR `sanatorium-vnext.md` сам отмечает это дублирование.

---

## 4. Выбор бенчмарков (по 3 на бандл) и почему

| Бандл | Продукт | Почему именно он |
|---|---|---|
| Клиника | **MEDODS** (РФ, адаптирован под KZ/UZ) | Ближайший прямой конкурент в СНГ для частных клиник: ЭМК с шаблонами протоколов, планы лечения, онлайн-запись/ЛК/приложение, мессенджеры (WhatsApp/Telegram/MAX), телефония, лаборатории, ДМС, 2FA. Цены публичные (облако 6 900 ₽/мес за 2 места). [S1–S4] |
| Клиника | **Medesk** (РФ + международная версия, 50+ стран) | Эталон облачной МИС: 60+ шаблонов осмотров на 24 специальности + конструктор, телемедицина «перевести приём в видео», онлайн-запись с предоплатой, анкеты до приёма, телефония, CRM-задачи. [S5–S7] |
| Клиника | **Cliniko** (глобальный SaaS) | Эталон простоты и открытого API: публичный REST API (доступные слоты, treatment notes, шаблоны, счета), онлайн-запись с правилами, телемед-ссылки в напоминаниях, формы/согласия с e-подписью, body charts. [S8–S10] |
| Больница | **МИС «Медиалог»** (РФ, РТК) | Хорошо документированные стационарные процессы: приёмное отделение (витальные, шкалы Морсе/ВАШ/Ватерлоу, браслеты, монитор этапов), лист назначений с отметками выполнения и остатками склада, эпикризы. [S11–S12] |
| Больница | **Damumed** (Казахстан) | Ближайшая модель к AZ: МИС, интегрированная с государственным «электронным паспортом здоровья» и eGov; стационар: истории болезни, назначения, температурные листы, реанимационное наблюдение, диетучёт, расчёт стоимости, выписной эпикриз уходит в eGov. [S13] |
| Больница | **Epic** (США, gold standard) | Референс по архитектуре стационара: ADT/Grand Central (койки, потоки), ClinDoc (flowsheets, care plans, eMAR со штрих-кодом), Beaker (LIS), MyChart (портал) и MyChart Bedside. Не конкурент в AZ, но задаёт «правильную» декомпозицию. [S14–S15] |
| Санаторий | **1С:Санаторий / 1С-Рарус «Управление санаторно-курортным комплексом»** | Самый распространённый в СНГ стандарт: путёвки/курсовки, карта гостя (RFID/штрихкод), назначения процедур, диспетчеризация кабинетов с перерывами и совместимостью, диетстолы и раскладки, расходники. [S16–S17] |
| Санаторий | **ХИТ (Б-Офис)** | PMS + медблок в одном: МКБ-10, шаблоны, авто-диспетчеризация процедур, ЭИБ, лаборатории, склад с автосписанием, мобильные приложения гостю и персоналу, BI. Публичный прайс модулей. [S18] |
| Санаторий | **Bnovo** (PMS + модуль бронирования для санаториев) | Лидер по продаже: учёт путёвок, лечебные программы в тарифах, защита от овербукинга, модуль онлайн-бронирования санаторных программ; медицину сам по себе не ведёт — это наша точка превосходства. [S19–S20] |

Рассмотрены, но не взяты в топ-3: IDENT (в основном стоматология), Cliniccards (Украина, близко к MEDODS), Doctolib/Jane (рынки ЕС/Канада), Cerner/Oracle Health (аналог Epic), MedElement (KZ, ближе к поликлинике/справочникам), qMS, OpenMRS (open-source, полезен как модель данных, но не как UX-бенчмарк), Travelline (бронирование, не медицина).

---

## 5. Сравнение по бандлам

### 5.1. Клиника (амбулатория) — глубоко

**У них есть, у нас нет (или прототип):**

| # | Возможность | Кто | У нас |
|---|---|---|---|
| C1 | Структурированный протокол приёма по шаблону специальности (жалобы, анамнез, объективно, диагноз, план, рекомендации), обязательные поля, «быстрые ответы», копия прошлого протокола | Medesk (60+ шаблонов), MEDODS, Cliniko | 🔴 (есть только CPOE-формы диагностики) |
| C2 | Рабочий стол врача: расписание дня, «пациент пришёл», открытие карты, история визитов/анализов в одном экране | MEDODS, Medesk | 🔴 `/doctor` — список |
| C3 | Онлайн-запись: виджет на сайт, выбор услуги/врача, **свободные слоты**, правила (горизонт, мин. время до записи, лимиты), предоплата, отмена пациентом | Cliniko API `available_times`, Medesk, MEDODS | 🟡 есть эндпоинт без слотов, выключен в проде |
| C4 | Многоканальные уведомления: подтверждение, напоминание, «результаты готовы», отзыв, ДР; fallback WhatsApp→SMS; ответ пациента меняет статус записи; история в карточке | MEDODS, Medesk, Cliniko | 🟡 один WhatsApp-шаблон, UTC-время |
| C5 | Личный кабинет/приложение пациента: записи, результаты, документы, оплата, видеоприём | MEDODS, Medesk, Epic MyChart | 🔴 токен + JSON |
| C6 | Телемедицина: перевод приёма в видео одной кнопкой, ссылка в напоминании | Medesk Meet, Cliniko | 🔴 |
| C7 | Анкеты до приёма, информированные согласия с e-подписью | Cliniko, Medesk | 🔴 (но есть ADR `asan-sima-gov-signature.md` — можно переиспользовать ASAN İmza) |
| C8 | План лечения с этапами и сметой (особенно стоматология/косметология) | MEDODS, IDENT | 🔴 для амбулатории (у санатория есть программы) |
| C9 | Справочник лекарств в рецепте, печать рецепта, отправка рецепта пациенту | Medesk (ГРЛС), MEDODS | 🟡 свободный SKU |
| C10 | Телефония (карточка при звонке, запись разговоров) | MEDODS, Medesk | 🔴 (делается в интеграционном слое CRM — переиспользовать) |
| C11 | Маркетинг/CRM: сегменты, рассылки, источники, рефералы, отзывы и рейтинг врачей | MEDODS | 🔴 (частично закрывает `era-crm`) |
| C12 | Лист ожидания, повторяющиеся записи, групповые записи | MEDODS, Cliniko | 🔴 |
| C13 | Интеграции с внешними лабораториями (у них INVITRO/HELIX/KDL; в AZ — местные сети) | MEDODS, ХИТ | 🟡 только файловый импорт |
| C14 | 2FA для персонала | MEDODS (2026) | ❓ не подтверждено (найдено 5 файлов с `otp/totp` — требуется проверка, вероятно SSO-уровень) |
| C15 | Публичный документированный API/вебхуки для партнёров | Cliniko | 🟡 есть внутренние API и события, публичной документации нет |

**У нас есть, у них нет (подтверждено кодом):**

- Деньги и учёт — в общем ядре ERA: события `SATELLITE_CLINIC_VISIT_COMPLETED`/`LAB_ORDER_COMPLETED` → Finance (счёт, дебиторка, GL), касса со сменами X/Z, мульти-канальная оплата, единый счёт визита (`cashier_*.ts`). У MEDODS/Medesk бухгалтерия — интеграция с 1С.
- Платформенный MDM пациента по FIN/паспорту (`mdm_person-lookup/merge`, `globalPersonId`) — один человек во всех организациях экосистемы.
- Сильная лаборатория «из коробки»: каталог ~362 аналитов, нормы, критические флаги, бланки Word, печать на AZ/RU/EN (CLI-32/34/60).
- МКБ-10 в трёх редакциях (WHO 2019, RU, AZ XBT-10) через платформенный gateway (CLI-41).
- Мультиресурсное планирование (врач + кабинет + оборудование, HARD/SOFT персонал) и движок ротаций смен — глубже, чем у Cliniko/Medesk.
- Мультитенантность, аудит мутаций (Layer A/B), роли из БД.
- Рецепт уходит в очередь собственной аптеки (`era-retail-pos`) — сквозной сценарий «врач → аптека» внутри экосистемы.

**Наши слабые места (клиника):**

1. Врач не может нормально провести приём в системе — нет протокола осмотра и рабочего стола (C1, C2). Это первое, что смотрит клиника на демо.
2. Пациентский контур (запись/напоминания/кабинет/видео) — на уровне прототипа (C3–C6).
3. UX-прототипы в боевых экранах: `window.prompt` в страховке, сырой JSON в портале и в результатах проверки полиса.
4. Документация обещает больше, чем есть (раздел 3.1 ⚠️).

### 5.2. Больница (стационар) — глубоко

**У них есть, у нас нет:**

| # | Возможность | Кто | У нас |
|---|---|---|---|
| H1 | Приёмное отделение: регистрация обращения (планово/экстренно, из листа ожидания госпитализации), доврачебный осмотр (витальные, антропометрия, шкалы), первичный осмотр, решение «госпитализация/отказ», монитор этапов и времени пребывания | Медиалог, Epic ADT | 🔴 |
| H2 | Лечащий врач, отделение, профиль койки, история движения (перевод между отделениями) | все | 🔴 |
| H3 | Дневники врача, этапные эпикризы, консилиумы | Медиалог, Damumed | 🔴 |
| H4 | Лист назначений: лекарства (доза/путь/кратность/период), процедуры, режим, диета; сетка «дата × назначение» с отметками выполнения; наличие на складе отделения | Медиалог, Damumed, Epic eMAR | 🔴 |
| H5 | Температурный лист / flowsheets / витальные показатели, шкалы риска | Damumed, Epic ClinDoc, Медиалог | 🔴 |
| H6 | Сестринский пост: задачи по времени из листа назначений | Медиалог, Epic | 🔴 |
| H7 | Выписной эпикриз (автосбор из дневников/диагнозов/анализов), печать, передача в госсистему | Damumed (→ eGov), Медиалог | 🔴 |
| H8 | Расчёт стоимости случая лечения (койко-дни + назначения + услуги) и реестры для страховой | Damumed, Epic | 🟡 только койко-день |
| H9 | Операционная, анестезия, реанимационная карта | Epic, Damumed | 🔴 (P2) |
| H10 | Диетпитание (столы, раскладки, порционник) | Damumed, 1С:Санаторий | 🔴 |
| H11 | Склад отделения и списание медикаментов по факту выполнения назначения | Медиалог, ХИТ | 🟡 есть ТТК расходников процедур (`ProcedureConsumableLine`) и outbox, для лекарств — нет |
| H12 | Браслет пациента (идентификация при выполнении назначений) | Медиалог, Epic | 🟡 есть QR-токены гостя (`identity_guest-qr.ts`) — можно переиспользовать |

**У нас есть, у них нет:** общая с амбулаторией и санаторием база (одна БД/SSO/MDM, единые МКБ и лаборатория), события в Finance, облачная мультитенантность, планировщик ресурсов (переиспользуем для операционных и процедурных).

**Наши слабые места (больница):** фактически продаётся учёт коек. Без H1–H7 нельзя заявлять «больница», можно максимум «дневной стационар / палаты наблюдения». ADR `clinic-product-lines-and-presets.md` прямо требует «не перепродавать M13 stub».

### 5.3. Санаторий

**У них есть, у нас нет:**

| # | Возможность | Кто | У нас |
|---|---|---|---|
| S1 | Диетпитание: назначение стола врачом при заезде, раскладки, порционник для кухни | 1С:Санаторий, ХИТ | 🔴 |
| S2 | Курсовки (лечение без проживания) как продуктовая сущность с ценой и сроком | 1С:Санаторий | 🟡 есть WALK_IN эпизоды и walk-in группы — без «курсовки» как продукта |
| S3 | RFID/браслеты/карта гостя для прохода и отметки процедур | 1С:Санаторий | 🟡 QR (сильный анти-фрод, но без браслетов/СКУД) |
| S4 | Привязка процедур к приёмам пищи (минеральная вода за 30–45 мин до еды) | 1С:Санаторий | 🟡 есть отдых гостя/перерывы, нет «якоря» на питание |
| S5 | Онлайн-продажа путёвок/программ с сайта, OTA | Bnovo, Travelline, ХИТ | Вне клиники — зона `era-hotel-pms` (`hotel_distribution`) |
| S6 | Мобильное приложение гостя (расписание процедур, уведомления) | ХИТ | 🔴 (есть печать листа процедур и портал-заглушка) |
| S7 | Склад с авто-списанием по протоколам, маркировка | ХИТ | 🟡 ТТК + outbox в отель/retail |
| S8 | BI-дашборды и конструктор отчётов | ХИТ, 1С | 🟡 фиксированные отчёты |

**У нас есть, у них нет (подтверждено кодом):** подтверждение плана врачом перед раскладкой (PROPOSED→FIFO), квоты пакетов с узлами и интерполяцией по ночам, замены/переносы квот с журналом, три временных слоя на 5-минутной сетке, ротации и замены процедур, совместимость и последовательности, месячные графики дежурств с дневными подменами, ванные серии, зоны физиотерапии S с алиасами, QR-check-in с окнами и анти-фродом, бонус врача по extras, выручка по revenue-кодам отеля, cutover-импорт из Elektraweb. Это уровень, которого у Bnovo нет вовсе, а у 1С/ХИТ — в виде «авто-диспетчеризации» без врачебного подтверждения и квотной механики.

**Слабые места (санаторий):** несколько ключевых волн в статусе SCREEN (CLI-55 эпизод-курс, CLI-57 extras до оплаты, CLI-58 ванные серии, CLI-62 открытая явка) → нужен UAT и перевод в SHIPPED; дубль медконтура в отеле; нет диет; нет приложения гостя.

---


## 8. Что проверить вручную (не удалось подтвердить чтением кода)

- Как сейчас завершается WALK_IN-визит амбулатории (через кассу?) — см. P0-04.
- Есть ли 2FA для персонала (найдены упоминания `otp/totp` в 5 файлах — вероятно, это SSO оркестратора).
- Доступен ли частным МИС официальный API e-Tabib/İTS и Rəqəmsal resept — уточнить в İTS и Rəqəmsal Səhiyyə Mərkəzi; до тех пор режим `manual`.

---

## 9. Источники

Наш код (все пути относительно `D:\My Projects\era-ecosystem`): `era-clinic/PRD.md`, `era-clinic/TZ.md`, `era-clinic/doc/*.md`, `era-clinic/prisma/schema.prisma`, `era-clinic/app/**`, `era-clinic/nest/native/controllers/**`, `era-clinic/src/domain/**`, `docs/adr/clinic-*.md`, `docs/adr/clinic/sanatorium-vnext.md`, `docs/COVERAGE_MATRIX.md`, `docs/editions/clinic.yaml`, `packages/satellite-kit/src/integration/clinic-module-keys.ts`, `era-hotel-pms/prisma/schema.prisma`.

Конкуренты и регуляторика:

- [S1] MEDODS — главная: https://www.medods.ru/
- [S2] MEDODS — тарифы: http://www.medods.ru/pricing
- [S3] MEDODS — виджет онлайн-записи: https://medods.ru/widget · WhatsApp-уведомления: https://medods.ru/features/whatsapp
- [S4] MEDODS — дайджест 1 кв. 2026 (2FA, мессенджеры, API): https://www.medods.ru/post/%D0%B4%D0%B0%D0%B9%D0%B4%D0%B6%D0%B5%D1%81%D1%82-%D0%BD%D0%BE%D0%B2%D0%BE%D1%81%D1%82%D0%B5%D0%B9-medods-%D0%B7%D0%B0-4-%D0%BA%D0%B2%D0%B0%D1%80%D1%82%D0%B0%D0%BB-2025-%D0%B3%D0%BE%D0%B4%D0%B0-c53f37c5-b5f4-494c-abb6-1aae9fdcee3c · адаптация под KZ: https://www.livebusiness.asia/tool/603/
- [S5] Medesk — главная: https://www.medesk.ru/
- [S6] Medesk — шаблоны протоколов: https://www.medesk.ru/protokoly/
- [S7] Medesk — обзор возможностей и тарифов (сторонний): https://mediium.ru/integrations/medesk/ · международная версия: https://www.medesk.net/en/
- [S8] Cliniko — возможности: https://www.cliniko.com/features/ · медкарта: https://www.cliniko.com/features/health-records/
- [S9] Cliniko — API: https://docs.api.cliniko.com/openapi/reference/overview
- [S10] Cliniko — телемедицина: https://www.cliniko.com/features/appointments/telehealth/ · настройка (формы, напоминания, онлайн-запись): https://help.cliniko.com/en/articles/5014228-cliniko-course-setting-up-your-account
- [S11] Медиалог 2.0 — «Приёмное отделение»: https://medialog.ru/novosti/funkcionalnyj-blok-priyomnoe-otdelenie/ · продукт: https://medialog.ru/products/medialog/
- [S12] Инструкция «Лист назначений в МИС Медиалог» (СибГМУ): https://book.ssmu.ru/стационар20/врач/инструкция_сибгму_лист_назначений_медиалог_1.1.pdf
- [S13] Damumed.Стационар (Google Play): https://play.google.com/store/apps/details?id=kz.cit_damu.hospital
- [S14] Epic ClinDoc (обзор): https://digitalhealth.folio3.com/blog/epic-clindoc-documentation-module/
- [S15] Epic — модули (обзор): https://www.remedihs.com/epic-consulting-guide-epic-ehr-modules/ · https://techfitflow.com/epic-modules/
- [S16] 1С:Санаторий — учёт путёвок, курсовок, процедур, диет: https://confaster.ru/blog/uchet-putevok-kursovok-i-procedur-1c-sanatorij/
- [S17] 1С-Рарус «Управление санаторно-курортным комплексом» (руководство): https://rarus.ru/downloads/2470/1c-rarus-umo-rucovodstvo-functionalnie-vozhmozhnosti.pdf
- [S18] ХИТ (Б-Офис) — санатории и wellness: https://b-office.ru/products/hit/wellness-center
- [S19] Bnovo PMS для санатория: https://bnovo.ru/bnovo-pms-sanatoriya/
- [S20] Bnovo — модуль бронирования для санатория: https://bnovo.ru/bnovo-mb-sanatorium/
- [S21] Положение о базе данных İcbari Tibbi Sığorta (№ 308): https://e-qanun.az/framework/48393
- [S22] İTS — выбор частной клиники в e-Tabib: https://its.gov.az/bloq/2775/vetendaslara-ozel-tibb-muessiselerini-elektron-qaydada-secmek-imkani-verilib · https://its.gov.az/bloq/2979/ozel-tibb-muessisesini-secmek-huququ-yalniz-pasiyente-mexsusdur
- [S23] İTS — медицинские данные в mygov: https://its.gov.az/bloq/3007/mygov-platformasinda-vetendaslarin-bir-sira-tibbi-melumatlara-cixis-imkanlari-genislendirildi
- [S24] Интервью директора Rəqəmsal Səhiyyə Mərkəzi (VSİS, Rəqəmsal resept, e-Epikriz, e-Bülleten, «Reseptim»): https://aztibb.az/az/news/35364-reqemsal-sehiyye-merkezinin-bas-direktoru-istifadeciler-ucun-elektron-sehiyye-ve-reseptim-mobil-tetbiqleri-istifadeye-verilib
- [S25] Всемирный банк — цифровой обмен данными в здравоохранении AZ (eTABIB, EMR): https://documents1.worldbank.org/curated/en/099065002202321575/pdf/P17563409afbf20fc09a3305cbde1109482.pdf
- [S26] Минздрав AZ — стандарты и классификаторы: https://e-health.gov.az/StandardsAndClass

> Примечание: страницы its.gov.az на момент проверки отвечали нестабильно (504/404 при прямом запросе), факты взяты из поисковой выдачи с этих URL; перед юридически значимыми решениями перепроверить.

