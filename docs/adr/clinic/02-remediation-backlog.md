<!-- Split from medical-satellite-gap-analysis.md. Index: ./README.md -->

## 7. План доработок (для Cursor)

Оценка: **S** ≤ 2 дня, **M** 3–7 дней, **L** 2–4 недели, **XL** > 1 месяца (один разработчик + Cursor). Все новые модели — с `organizationId`, индексами и через tenant-extension Prisma (`src/lib/prisma.ts`). Все новые мутации — с аудитом (`SatelliteAuditLog`, ADR `satellite-mutation-audit.md`). Все новые экраны — по `DESIGN.md` / `EraListFilterBar` (CLI-37) и трёхъязычные (`messages/`).

### P0 — блокирует продажи клиникам и больницам

#### MED-P0-01. Честные статусы в документации · S
- **Зачем:** PRD обещает DONE там, где прототип; Cursor и продажи вводятся в заблуждение.
- **Файлы:** `era-clinic/PRD.md` §4 (M7, M8, M10, M11, M12, M13, M14), `era-clinic/doc/DELIVERY-CLINIC.md`, `docs/COVERAGE_MATRIX.md` (CLI-15, CLI-22), `docs/editions/clinic.yaml`.
- **Приёмка:** M8 → PARTIAL («только лаб-результаты, без UI»); M12 → PARTIAL («proxy, UI prompt»); M13 → PARTIAL/«ward-lite»; M14 → STUB; M11 HL7 → STUB; M10 переименован в «Шаблоны результатов диагностики»; в PRD нет противоречий между §4, §6 и changelog.

#### MED-P0-02. Протокол приёма (EMR-lite для амбулатории) · L
- **Зачем:** C1 — главный разрыв с MEDODS/Medesk/Cliniko.
- **Модели (`prisma/schema.prisma`):**
  - `ClinicalNoteTemplate` (`organizationId`, `code`, `title` L10n JSON, `specialty?`, `sectionsJson` — секции и поля: text/textarea/select/multiselect/number/date/bodyMap, `required`, `quickAnswers[]`, `isActive`, `version`).
  - `ClinicalNote` (`organizationId`, `visitId?`, `clinicalEpisodeId?`, `admissionId?` (для стационара, см. P0-05), `patientRefId`, `authorPractitionerId`, `templateId`, `templateVersion`, `kind` enum `VISIT_EXAM | ADMISSION_EXAM | DAILY_DIARY | STAGE_EPICRISIS | DISCHARGE_SUMMARY | CONSULTATION`, `payloadJson` (снапшот полей как в `CpoePayloadV1`), `status` `DRAFT | SIGNED | AMENDED`, `signedAt`, `signedByUserId`, `amendsNoteId?`).
- **API (`nest/native/controllers/`):** `admin_note-templates.ts`, `admin_note-templates__id.ts`; `visits__id_notes.ts` (GET/POST), `notes__id.ts` (PATCH пока DRAFT), `notes__id_sign.ts`, `notes__id_amend.ts`; register each new class in `nest/native/clinic-native.module.ts` `controllers` array.
- **Домен:** `src/domain/notes/` (валидация required-полей по шаблону, снапшот, запрет правки SIGNED — только amend с ссылкой).
- **UI:** вкладка «Осмотр» в `app/visits/[id]/page.tsx` (форма по шаблону, «копировать из прошлого визита», быстрые ответы, автоподстановка МКБ из `DiagnosisPanel`); SatAdmin `/admin/note-templates` (конструктор секций); печать — расширить `app/print/visit-exam/[id]` + `src/domain/print/print-visit-exam.service.ts`.
- **Seed:** 10 базовых шаблонов (терапевт, педиатр, кардиолог, невролог, гинеколог, уролог, ЛОР, офтальмолог, дерматолог, физиотерапевт) — `prisma/seed-data/base/note-templates.json`.
- **Права:** `CLINIC_PERMISSION.API_VISITS` для записи; подпись — только автор-врач; добавить `screen:admin.note-templates`.
- **Приёмка:** врач открывает визит → выбирает шаблон → незаполненные required блокируют «Подписать» (409 `NOTE_REQUIRED_FIELDS`) → после подписи правка только через «Дополнение» → печать на AZ/RU/EN показывает подписанную версию → в карточке пациента лента показывает протоколы → аудит фиксирует sign/amend. Unit-тесты в `__tests__/notes/*`.

#### MED-P0-03. Рабочий стол врача · M
- **Зачем:** C2.
- **Файлы:** `app/doctor/page.tsx` (переписать), новый `nest/native/controllers/doctor_day.controller.ts` → `GET /api/doctor/day?date=` (записи врача на день из `Appointment` + статусы + `QueueTicket` + флаги «есть неподписанный протокол», «есть готовые анализы»); `src/domain/appointment/` (запрос «мои записи» по `practitionerId` текущего пользователя).
- **UI:** слева — таймлайн дня (Asia/Baku), справа — карточка выбранного пациента: шапка (возраст/пол/группа крови/аллергии-противопоказания), последние 5 визитов с протоколами, последние результаты лабораторий (критические — красным), кнопки «Вызвать» (очередь), «Начать приём», «Завершить».
- **Приёмка:** врач видит только свои записи (или все — при праве); статусы обновляются без перезагрузки (polling 30 с); «Начать приём» создаёт `Visit` IN_PROGRESS из записи; пустой день — пустое состояние; Lighthouse/UX: открытие ≤1,5 с на 50 записях.

#### MED-P0-04. Явный сценарий завершения визита для WALK_IN · S
- **Зачем:** в `app/visits/[id]/page.tsx` `canComplete` разрешён только для `IN_HOUSE`/`HOTEL` (в enum `PatientOrigin` значения `HOTEL` нет — мёртвая ветка).
- **Файлы:** `app/visits/[id]/page.tsx`, `nest/native/controllers/visits__id_complete.controller.ts`, `src/domain/visit/visit-pay-gate.ts`.
- **Приёмка:** для WALK_IN кнопка «Завершить и отправить в кассу» (визит → ожидает оплаты, появляется в `/cashier` очереди); для IN_HOUSE — как сейчас (на фолио); удалена ветка `HOTEL`; тест на оба сценария.

#### MED-P0-05. Стационар-MVP: приёмное, лечащий врач, дневник, лист назначений, витальные, эпикриз · XL (разбить на 4 PR)
- **Зачем:** H1–H7; без этого «больница» продаваться не может.
- **PR-1 Поступление (M):**
  - `InpatientAdmission` + поля: `admissionKind` enum `PLANNED | EMERGENCY`, `source` (`SELF | REFERRAL | AMBULANCE | TRANSFER | ITS_REFERRAL`), `referralRef?`, `departmentId` (переиспользовать `ServiceDepartment` или новый `Department` с `kind=INPATIENT`), `attendingPractitionerId`, `admissionNoteId?`, `refusalReason?`, `outcome` enum `RECOVERED | IMPROVED | UNCHANGED | WORSENED | TRANSFERRED | DIED | SELF_DISCHARGE` (при выписке), `caseNumber` (сквозной номер истории болезни по году).
  - Статусы: `REGISTERED → ADMITTED → DISCHARGED | REFUSED` (убрать фиктивный `TRANSFERRED`; переводы — новая модель `InpatientMovement` (from/to bed, from/to department, at, reason, byUserId)).
  - `Bed.status` → enum `AVAILABLE | OCCUPIED | CLEANING | BLOCKED`.
  - Файлы: `prisma/schema.prisma`, `src/domain/inpatient/adt.service.ts`, `ward.service.ts`, `nest/native/controllers/inpatient.controller.ts` (разнести на `inpatient_admissions.ts`, `inpatient_admissions__id_*.ts`), `app/inpatient/page.tsx` (поиск пациента через серверный поиск вместо `pageSize=100`).
  - Приёмка: «Приёмное» — список обращений с этапами (Регистрация → Осмотр → Решение) и временем ожидания; отказ требует причину; при госпитализации генерируется номер истории; перевод пишет `InpatientMovement`; койка после выписки → `CLEANING`.
- **PR-2 Дневники и эпикриз (M):** использовать `ClinicalNote` из P0-02 с `kind = ADMISSION_EXAM | DAILY_DIARY | DISCHARGE_SUMMARY`. Эпикриз автособирает: диагнозы (`AdmissionDiagnosis`), даты, проведённое лечение (из P0-05 PR-3), ключевые анализы (`LabOrder` по `admissionId`), рекомендации. Печать `app/print/discharge/[admissionId]`. Приёмка: выписка (`DISCHARGED`) запрещена без подписанного эпикриза (409 `DISCHARGE_SUMMARY_REQUIRED`, настраивается в `Tenant`).
- **PR-3 Лист назначений + сестринский пост (L):**
  - Модели: `MedicationCatalog` (общий с P1-04: `code`, `innName`, `tradeName`, `form`, `strength`, `unit`, `atcCode?`, `financeSku?`), `InpatientOrder` (`admissionId`, `kind` `MEDICATION | PROCEDURE | REGIMEN | DIET | NURSING`, `medicationId?`, `procedureTypeId?`, `dose`, `doseUnit`, `route` enum (PO, IV, IM, SC, TOP, INH…), `frequency` (например `"08:00,14:00,20:00"` или `q8h`), `startAt`, `endAt?`, `prn`, `status` `ACTIVE | STOPPED | COMPLETED`, `orderedByPractitionerId`), `OrderAdministration` (`orderId`, `scheduledAt`, `status` `DUE | GIVEN | MISSED | REFUSED | HELD`, `givenAt`, `givenByUserId`, `note`).
  - Генерация `OrderAdministration` на 48 ч вперёд cron'ом `cron_inpatient-mar-generate.ts` (по образцу `cron_inpatient-daily-charges.ts`).
  - UI: «Лист назначений» — сетка дата × назначение с иконками статусов (как в Медиалог); «Пост медсестры» `/inpatient/nurse` — задачи на смену по времени, отметка «выполнено» (с QR пациента — переиспользовать `identity_guest-qr.ts`).
  - Приёмка: назначение с кратностью 3 р/д генерирует 3 задачи в сутки; отметка пишет кто/когда; просроченные >30 мин — красные; остановка назначения отменяет будущие DUE; списание расходника — через существующий outbox (`ConsumptionOutbox`) при `GIVEN`, если у лекарства есть `financeSku`.
- **PR-4 Витальные и шкалы (M):** модель `VitalSign` (`patientRefId`, `admissionId?`, `visitId?`, `clinicalEpisodeId?`, `kind` enum `TEMP | BP_SYS | BP_DIA | PULSE | RESP | SPO2 | WEIGHT | HEIGHT | PAIN | GLUCOSE`, `value Decimal`, `unit`, `measuredAt`, `byUserId`) + `RiskAssessment` (`scale` `MORSE | WATERLOW | NEWS2 | VAS`, `score`, `answersJson`). UI: температурный лист (график) в карточке госпитализации, ввод с поста. Приёмка: график за период госпитализации; значения вне диапазона подсвечены; доступны в эпикризе и в амбулаторном визите (переиспользование).
- **Пресет/модули:** всё под `inpatient_day` + `clinic_inpatient`; обновить `presetsRequiredForPath` и `CLINIC_MODULE_BY_ROUTE`.

#### MED-P0-06. Онлайн-запись со свободными слотами и виджетом · L
- **Зачем:** C3.
- **API:** `GET /api/booking/availability?serviceCode=&practitionerCode=&from=&to=` — переиспользовать слот-ядро (`evaluateCandidateSlot` CLI-58 / `practitioner-schedule.service.ts` / `electiveDayDenied`), учитывать смены (CLI-36), длительность (`Practitioner.defaultSlotMinutes`), правила онлайн-записи; `POST /api/booking/appointments` — принимать `serviceCode`, проверять слот атомарно (409 `SLOT_TAKEN`), выдавать `cancelToken`; `POST /api/booking/appointments/:token/cancel`.
- **Модели:** `Tenant` + `onlineBookingEnabled`, `onlineBookingHorizonDays`, `onlineBookingMinLeadMinutes`, `onlineBookingRequirePhoneOtp`; `Practitioner.onlineBookable`, `ServiceCatalogCache.onlineBookable`; `Appointment` + `source` (`STAFF | WEB | PORTAL | CRM | AGGREGATOR`), `confirmedAt`, `cancelToken`.
- **UI:** публичная страница `app/booking/page.tsx` (выбор услуги → врача → дня → слота → телефон + OTP), встраиваемый `<script>`/iframe виджет; настройки в `/admin/settings`. Флаг env `CLINIC_PUBLIC_BOOKING_ENABLED` заменить на настройку организации.
- **Приёмка:** нельзя записаться в нерабочее время/на занятый слот/ближе min lead; двойная отправка не создаёт дубль; запись видна на `/appointments` с бейджем «онлайн»; пациент-заглушка связывается с MDM при первом визите (как сейчас SEC-CLI-02); rate-limit на публичный эндпоинт.

#### MED-P0-07. Уведомления пациенту v1 · M (зависит от интеграционного слоя CRM/платформы)
- **Зачем:** C4.
- **Файлы:** `src/domain/appointment/appointment-calendar.service.ts` (`processAppointmentRemindersForOrganization`), новый `src/domain/notify/clinic-notify.service.ts`, `nest/native/controllers/cron_appointment-reminders.controller.ts`.
- **Сделать:** шаблоны по ключам (`clinic.appointment.created`, `.reminder`, `.cancelled`, `clinic.lab.published`, `clinic.feedback.request`) на AZ/RU/EN с плейсхолдерами; **время в Asia/Baku** (`bakuDateTimeDisplay`), не ISO; канал по приоритету (WhatsApp → SMS fallback) через `platform_notifications`; ссылка подтверждения/отмены; модель `PatientMessageLog` (или чтение журнала платформы) → вкладка «Коммуникации» в карточке пациента; настройки «за сколько часов напоминать».
- **Приёмка:** напоминание приходит с локальным временем и именем врача на языке пациента; ответ «подтверждаю» по ссылке ставит `Appointment.confirmedAt`; отмена освобождает слот; повторно не отправляется (`reminderSentAt`); лог виден в карточке.

#### MED-P0-08. Мелкие баги, найденные при анализе · S
- `nest/native/controllers/visits__id_prescription.controller.ts`: `prescriptionQueueId` читать из `await queued.json()`, а не из `httpReq.body`.
- `app/visits/[id]/page.tsx`: заменить `window.prompt` в `checkInsurance` на модалку; результат — человекочитаемая карточка (статус, страховщик, лимит), не `JSON.stringify`.
- `app/portal/page.tsx`: убрать вывод сырого JSON (временно — таблица результатов; полноценно — P1-01).
- `src/domain/inpatient/adt.service.ts`: убрать двойной апдейт статуса `TRANSFERRED → ADMITTED` (до P0-05).
- **Приёмка:** юнит-тест на ответ prescription с id; ни один боевой экран не выводит `JSON.stringify` пользователю (grep-проверка в CI).

### P1 — догоняем лидеров и закрываем AZ-специфику

#### MED-P1-01. Портал пациента v2 · L
- **Файлы:** `app/portal/*`, `nest/native/controllers/portal_session.controller.ts`, `src/domain/portal/portal-session.service.ts`.
- **Сделать:** вход по OTP на телефон (или ссылка из уведомления), разделы: «Мои записи» (запись/перенос/отмена через P0-06), «Результаты» (PDF-бланки как в печати), «Документы» (подписанные протоколы/эпикризы), «Счета и оплата» (payment link из Finance), «Видеоприём» (P1-02); PWA.
- **Приёмка:** пациент без звонка записывается и отменяет; видит только свои данные по `globalPersonId`; каждый доступ в аудите (`PORTAL_ACCESS` уже есть); модуль `platform_portal` гейтит.

#### MED-P1-02. Телемедицина · M
- **Модели:** `Appointment.mode` `IN_PERSON | VIDEO`, `videoRoomUrl`, `videoProvider`.
- **Интеграция:** адаптер `src/integration/telehealth/` (Jitsi self-hosted по умолчанию; Daily/Zoom — через ключи организации).
- **UI:** кнопка «Перевести в видео» на записи; ссылка в напоминании; кнопка «Подключиться» у врача на рабочем столе (P0-03) и у пациента в портале. Создать страницу или убрать мёртвый маршрут `/telehealth` из `CLINIC_MODULE_BY_ROUTE`.
- **Приёмка:** видеоприём создаётся в 1 клик, ссылка уникальна и истекает после приёма; протокол приёма (P0-02) ведётся параллельно; модуль `clinic_telehealth` выключен → кнопок нет.

#### MED-P1-03. Страхование: İTS + ДМС · L
- **Модели:** `PatientInsurancePolicy` (`patientRefId`, `payerKind` `ITS | DMS | CORPORATE`, `payerCounterpartyId` (Finance), `policyNumber`, `validFrom/To`, `programCode?`), `InsuranceReferral` (`policyId?`, `source` `E_TABIB | INSURER | MANUAL`, `referralCode`, `issuedAt`, `expiresAt` (по умолчанию +10 рабочих дней для e-Tabib), `allowedServiceCodes[]`, `status` `NEW | USED | EXPIRED | REJECTED`), `Visit.payerKind` + `Visit.referralId?`, `VisitServiceLine.payer` (`PATIENT | ITS | DMS`).
- **Интеграция:** `src/integration/its/` порт `ItsReferralGateway` с режимами `disabled | manual | api`; в `manual` регистратор вводит код направления и прикладывает скан; `api` — заготовка под будущий доступ.
- **Отчёты:** реестр оказанных услуг по İTS/страховщику за период (CSV/XLSX) для возмещения; событие в Finance для дебиторки страховщику.
- **Файлы:** `prisma/schema.prisma`, `nest/native/controllers/insurance_*.ts`, `app/visits/[id]/page.tsx`, `src/components/AppointmentCreateModal.tsx`, `/reports/insurance`.
- **Приёмка:** визит по направлению İTS не попадает в кассу пациенту по покрытым услугам; просроченное направление не принимается (409 `REFERRAL_EXPIRED`); реестр сходится с суммами визитов; ДМС-проверка через Finance показывается карточкой.

#### MED-P1-04. Рецепты со справочником лекарств · M
- **Модели:** `MedicationCatalog` (из P0-05 PR-3), `Prescription` + `PrescriptionLine` (`medicationId`, `dose`, `route`, `frequency`, `durationDays`, `qty`, `instructions` L10n), `status` `ISSUED | SENT_TO_PHARMACY | DISPENSED | CANCELLED`.
- **Файлы:** `nest/native/controllers/visits__id_prescription.controller.ts` (переписать на справочник), печать `app/print/prescription/[id]`, адаптер `src/integration/e-resept/` (manual export → будущий «Rəqəmsal resept»).
- **Приёмка:** врач находит препарат по МНН/торговому за ≤3 символа; печать рецепта на AZ; отправка в аптеку `era-retail-pos` возвращает id очереди; в карточке пациента видна история рецептов.

#### MED-P1-05. Анкеты до приёма и информированные согласия · M
- **Модели:** `PatientFormTemplate`, `PatientFormResponse` (`appointmentId?`, `patientRefId`, `answersJson`, `signedAt`, `signatureKind` `SIMPLE | OTP | ASAN_IMZA`).
- **Переиспользовать:** ADR `docs/adr/asan-sima-gov-signature.md` для подписи ASAN İmza/SİMA.
- **Приёмка:** ссылка на анкету уходит в подтверждении записи; ответы видны врачу в рабочем столе; процедура/операция с флагом `consentRequired` блокируется без подписанного согласия (409 `CONSENT_REQUIRED`).

#### MED-P1-06. План лечения для амбулатории · M
- Переиспользовать механику программ санатория (`ProgramTemplate*`, `ProgramInstance`) в облегчённом виде: этапы, услуги, смета, статус согласования пациентом, перевод этапа в записи.
- **Приёмка:** врач создаёт план из 3 этапов → пациент получает смету → после согласования этапы записываются в календарь; выполнение видно в карточке.

#### MED-P1-07. Диетпитание (санаторий + стационар) · M
- **Модели:** `DietTable` (каталог столов/диет: `code`, `title` L10n, `description`), `DietAssignment` (`clinicalEpisodeId?`, `admissionId?`, `dietTableId`, `from`, `to?`, `assignedByPractitionerId`, `notes`).
- **Выход:** порционник на день по столам (печать + API для `era-fnb-pos`/кухни отеля).
- **Приёмка:** врач назначает стол при заезде/поступлении; порционник на завтра считается автоматически; смена стола видна с завтрашнего дня.

#### MED-P1-08. Санаторий: вывести SCREEN-волны в SHIPPED и убрать дубль в отеле · L
- **CLI-55, CLI-57, CLI-58, CLI-62** — пройти UAT по `era-clinic/doc/UAT-SMOKE.md`, закрыть AC в `docs/COVERAGE_MATRIX.md`.
- **Дубль медконтура отеля** (`MedicalAlert`, `MedicalOrder`, `LabResult`, `MedicalProcedure`, `ProcedureAppointment` в `era-hotel-pms/prisma/schema.prisma`) — по `sanatorium-vnext.md`: заморозить запись, мигрировать в клинику, оставить в отеле только read-model.
- **Приёмка:** четыре строки COVERAGE_MATRIX → SHIPPED с подписью поля; в отеле нет UI создания медицинских сущностей при активном `industry_clinic`.

#### MED-P1-09. Лист ожидания, повторяющиеся и групповые записи · M
- `WaitlistEntry` (`patientRefId`, `serviceCode?`, `practitionerId?`, `preferredFrom/To`, `status`), автопредложение при отмене записи; «повторить запись N раз с шагом»; групповые записи (ЛФК/школы).
- **Приёмка:** при отмене слота регистратор видит подходящих из листа ожидания; серия из 10 записей создаётся одной операцией с проверкой конфликтов.

#### MED-P1-10. Интеграции с лабораториями и оборудованием · L
- HL7 v2 ORU/ORM и ASTM для анализаторов (CLI-23 STUB → реальный), адаптеры к местным сетям лабораторий (импорт PDF + структурированный, если есть API). Порт `src/integration/lis/`.
- **Приёмка:** результат анализатора попадает в `LabResult` по штрихкоду пробы без ручного ввода; ошибки сопоставления — в очереди разбора.

#### MED-P1-11. Аналитика клиники · M
- Отчёты: no-show %, загрузка врачей/кабинетов (переиспользовать матрицу нагрузки), конверсия онлайн-записи, повторные визиты, средний чек, LTV; выгрузка XLSX.
- **Приёмка:** owner-дашборд на `/` показывает 6 KPI за период; цифры сходятся с сырыми данными (тест на фикстурах).

### P2 — развитие

| ID | Что | Оценка |
|---|---|---|
| MED-P2-01 | Операционный блок: план операций, бригада, операционные как `Resource` (переиспользовать мультиресурсный планировщик), протокол операции и анестезии | XL |
| MED-P2-02 | eMAR со сканированием браслета/штрихкода препарата, двойная проверка для high-alert препаратов | L |
| MED-P2-03 | Стоимость случая лечения / КСГ-DRG-подобная группировка, реестры страховщику по случаям | XL |
| MED-P2-04 | Пресет `wellness`: подключить гейтинг путей (сейчас пресет пустой) — расписание ресурсов + лёгкая карточка без EMR | M |
| MED-P2-05 | Мобильное приложение гостя санатория / пациента (PWA → нативное): расписание процедур, уведомления, QR | L |
| MED-P2-06 | Публичное API + вебхуки для партнёров (по образцу Cliniko: availability, appointments, patients, notes) с документацией OpenAPI | L |
| MED-P2-07 | FHIR-фасад (Patient, Encounter, Observation, Condition, MedicationRequest, DocumentReference) для будущих госинтеграций AZ | L |
| MED-P2-08 | Стоматология (зубная формула) — только если пойдём в этот сегмент (MEDODS/IDENT сильны) | L |
| MED-P2-09 | Браслеты/RFID и СКУД для санатория | M |
| MED-P2-10 | Маркетинг пациентов (сегменты, рассылки, отзывы, рейтинг врачей) — через `era-crm`, не в клинике | M |

### Рекомендуемая последовательность

1. **Неделя 1:** P0-01, P0-04, P0-08 (быстрые, снимают риски демо).
2. **Недели 2–5:** P0-02 → P0-03 (врачебное ядро), параллельно P0-06 + P0-07 (пациентский контур; P0-07 — после готовности интеграционного слоя мессенджеров из CRM-ТЗ).
3. **Недели 4–10:** P0-05 PR-1 → PR-2 → PR-4 → PR-3 (стационар-MVP).
4. **Дальше:** P1-03 (İTS) и P1-01/P1-02 как пакет «современная клиника», P1-08 для санатория, остальное по спросу.

---

