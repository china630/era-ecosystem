# Аудит era-clinic — 25 ноября 2026, 04:03+ (Asia/Baku)

Проверка только по коду на `D:\My Projects\era-ecosystem\era-clinic`. Коммиты, UAT и DoD не оценивались. Эталон — исходный план из `medical-satellite-gap-analysis.md` (см. §0 про разбиение файла).

Статусы: **сделано** / **частично** / **не сделано** / **регрессия**. Регрессий ранее работавшего поведения не видно; ниже — баги в новом коде.

Итог по пунктам плана (29): **сделано 1**, **частично 15**, **не сделано 13**. Из четырёх явных багов P0-08 три закрыты, сценарий «Завершить» для WALK_IN закрыт только в кнопке.

---

## 0. Файл анализа

`docs\adr\medical-satellite-gap-analysis.md` **заменён заглушкой** (434 байта, 25.11.2026 3:34). Канон разнесён, по той же схеме, что CRM:

- `docs/adr/clinic/00-gap-vs-mis-benchmarks.md`
- `docs/adr/clinic/01-az-regulatory.md`
- `docs/adr/clinic/02-remediation-backlog.md`
- индекс `docs/adr/clinic/README.md`

Исходный цельный файл (77 845 байт) сохранён на box: `/workspace/medical-satellite-gap-analysis.md`. Этот аудит сверялся с ним.

Миграции за 25.11 есть и в целом соответствуют новым моделям Prisma:

| Миграция | Таблицы / типы |
|---|---|
| `20261125120000_clinical_notes` | `ClinicalNoteTemplate`, `ClinicalNote`, enum kind/status |
| `20261125130000_inpatient_mvp` | статусы ADT, `BedStatus`, `inpatient_movement`, `vital_sign`, `risk_assessment`, `medication_catalog`, `inpatient_order`, `order_administration` |
| `20261125140000_telehealth` | `AppointmentMode`, `videoRoomUrl`, `videoProvider` |
| `20261125141000_p1_insurance_forms_prescription` | полисы, направления, рецепты, анкеты, `Visit.payerKind` |
| `20261125150000_diets` | диеты, назначения, care plan, лист ожидания |
| `20261125120000_audit_exempt_prefixes` | колонка `Tenant.audit_exempt_prefixes` |

Две миграции с одним префиксом `20261125120000` — риск порядка применения у Prisma. Расхождений «модель есть, миграции нет» по новым сущностям не видно.

---

## 1. Сводка по пунктам

### P0

| ID | Тема | Статус | Доказательства |
|---|---|---|---|
| P0-01 | Честные статусы в PRD/COVERAGE | **не сделано** (документы, см. сноску) | Вне кода. Не проверялось глубоко. |
| P0-02 | Протокол приёма | **частично** | Модели и сервис: `prisma/schema.prisma` (`ClinicalNote*`), `src/domain/notes/clinical-note.service.ts` (черновик, подпись с `NOTE_REQUIRED_FIELDS`, amend в транзакции, аудит). API: `nest/native/controllers/visits__id_notes.controller.ts`, `notes__id_sign.controller.ts`, `admin_note-templates*.ts`. UI: `VisitClinicalNotesPanel` на `app/visits/[id]/page.tsx:184`, админка `app/admin/note-templates`. Сид: 6 шаблонов (GP, кардио, педиатр, невролог, гинеколог, ЛОР) в `prisma/seed-data/base/note-templates.json` — в плане было 10. Печать `print-visit-exam.service.ts` **не включает** `ClinicalNote`. Отдельного UI дневника/эпикриза стационара нет. |
| P0-03 | Рабочий стол врача | **сделано** | `app/doctor/page.tsx` (13 КБ): день, опрос `/api/doctor/day` каждые 30 с, вызов из очереди, check-in, переход в визит, флаги лабораторий, `card-summary`. Сервис `src/domain/appointment/doctor-day.service.ts` режет область через `resolveClinicDataScope` (свои / все). |
| P0-04 | Завершение WALK_IN | **частично** | Кнопка есть: `canComplete` включает `WALK_IN` (`app/visits/[id]/page.tsx:154–159`), текст «в кассу». Но `POST /api/visits/:id/complete` тот же, что и для остальных, и для неоплаченного визита с `amountNet > 0` отвечает 409 `VISIT_AWAITING_PAYMENT` (`src/domain/visit/visit-pay-gate.ts`). Отдельного «отправить в кассу» нет; неоплаченные и так попадают в очередь кассы по `settledAt: null`. Ветка `HOTEL` в UI убрана. |
| P0-05 | Стационар-MVP | **частично** | API и модели есть: `register` / `refuse` / `admit` / `transfer` (пишет `InpatientMovement`, без мигания TRANSFERRED), `discharge` (койка → `CLEANING`), номер истории в `ward.service.ts`, витальные, лист назначений, cron MAR `cron_inpatient-mar-generate`, `BedStatus` enum. **UI `/inpatient` по-прежнему койки + перевод/выписка**, грузит `/api/patients?pageSize=100`. Нет экранов приёмного, дневника, листа назначений, поста, температурного листа. Нет `app/inpatient/nurse`, нет `app/print/discharge`. Выписка **не требует** подписанный `DISCHARGE_SUMMARY`. |
| P0-06 | Онлайн-запись со слотами | **частично** | `GET /api/booking/availability` + `listBookingAvailability` (свободные слоты матрицы, закрытые дни, длительность услуги). `POST` проверяет смену и `detectSchedulingConflict` → 409 `SLOT_TAKEN`. UI `app/booking/page.tsx` выбирает слот. Осталось: флаг всё ещё `CLINIC_PUBLIC_BOOKING_ENABLED` (не настройка организации); нет `cancelToken` / `Appointment.source` / OTP / min lead; проверка конфликта и создание **не в одной транзакции**, уникального ключа «врач+время» нет — гонка двойной записи. Успех оформлен как `throw new HttpException({ appointment }, 201)`. |
| P0-07 | Напоминания | **частично** | В тексте уже `bakuDateTimeDisplay` (`appointment-calendar.service.ts`, `processAppointmentRemindersForOrganization`, канал всё ещё только `WHATSAPP`, один шаблон `clinic.appointment.reminder`). Нет SMS-fallback, подтверждения/отмены, журнала в карточке (`PatientMessageLog` нет), шаблонов «создана запись / результаты / отзыв». В `createBookingAppointment` по-прежнему `scheduledAt.toISOString()`. |
| P0-08 | Мелкие баги | **частично** (3 из 4 закрыты) | См. таблицу багов ниже. |

### Баги из исходного анализа

| Баг | Статус | Где |
|---|---|---|
| `prescriptionQueueId` из тела запроса, всегда `null` | **сделано** | `visits__id_prescription.controller.ts:99–114` читает `await queued.json()` и пишет id в `Prescription`. |
| `window.prompt` в проверке страховки + сырой JSON | **сделано** (на визите) | Модалка с FIN и карточка статуса в `app/visits/[id]/page.tsx`. `window.prompt` остался в других местах: слияние пациентов (`PatientCardBody.tsx:412`) и причина сторно кассы (`app/cashier/page.tsx:277`) — это не страховка. |
| Портал выводит `JSON.stringify` | **сделано** | `app/portal/page.tsx` — таблица результатов и список записей, без сырого JSON. |
| `transferAdmission`: TRANSFERRED → сразу ADMITTED | **сделано** | `adt.service.ts` пишет только `InpatientMovement`, статус госпитализации не дёргается. |
| Кнопка «Завершить» только для IN_HOUSE | **частично** | См. P0-04. |

### P1

| ID | Тема | Статус | Доказательства |
|---|---|---|---|
| P1-01 | Портал v2 | **частично** | Таблица анализов + записи + ссылка на видео. Вход по-прежнему «вставь токен» в query `GET /api/portal/session?token=` (токен светится в логах). Нет OTP, документов, оплаты, отмены записи пациентом. |
| P1-02 | Телемедицина | **частично** | `enableVideoAppointment`, `POST /api/appointments/:id/telehealth`, страница `app/telehealth/page.tsx`, гейт модуля `clinic_telehealth`. Комната — публичный `https://meet.jit.si` по умолчанию, имя предсказуемое `era-clinic-{8 символов org}-{appointmentId}` (`src/integration/telehealth/jitsi.ts`). Ссылка в query и на странице открытым текстом, срока жизни нет, в напоминание не вшита. Это риск утечки сессии (PHI). |
| P1-03 | İTS + ДМС | **частично** | Модели `PatientInsurancePolicy`, `InsuranceReferral`; ручной шлюз `src/integration/its/manual-gateway.ts` (`disabled\|manual\|api`, api не реализован); API направлений; отчёт `insuranceServicesReport`; страница `app/reports/insurance`. **Визиту `payerKind` при оказании услуги не проставляется** (запись `payerKind` есть только у полиса) — реестр İTS, скорее всего, пустой. Срок направления: `+10` календарных дней, не рабочих; дата выпуска берётся из `issuedAt.toISOString().slice(0, 10)` (UTC, сдвиг относительно Баку). Режим шлюза — env, не настройка организации. |
| P1-04 | Рецепты со справочником | **частично** | `MedicationCatalog`, `Prescription`/`PrescriptionLine`, сервис резолвит SKU, печать `app/print/prescription/[id]`. UI визита по-прежнему три поля: свободный SKU / qty / описание, поиска по МНН нет. Адаптера `src/integration/e-resept` нет. Событие `SATELLITE_CLINIC_PRESCRIPTION_ISSUED` уходит **до** ответа аптеки: при 502 событие уже ушло, рецепт не создан. |
| P1-05 | Анкеты и согласия | **частично** | Шаблоны и ответы, админка `app/admin/patient-form-templates`. Подпись всегда `SIMPLE` (`patient-form.service.ts`), ASAN İmza не вызван. `CONSENT_REQUIRED` проверяется только на `POST /api/patient-forms/consent-check`, **на процедуры/операции не повешен**. Сотрудник может отправить `signed: true` без проверки подписи. Нет анкеты для пациента по ссылке. |
| P1-06 | План лечения амбулатории | **частично** | `AmbulatoryCarePlan` + `VisitCarePlanPanel` + `visits__id_care-plan.controller.ts`. Этапы в JSON, статусы DRAFT/PROPOSED/ACCEPTED. Нет автосоздания записей по этапам и сметы пациенту. |
| P1-07 | Диетпитание | **частично** | Справочник, назначения, порционник `GET /api/diet-portions`, печать `app/print/diet-portions`, админка столов. На карточке эпизода/госпитализации UI назначения не найден. Даты назначения пишутся как `YYYY-MM-DDT00:00:00.000Z` (`diet.service.ts:81`), а порционник режет день по Asia/Baku — риск ошибки на границе суток. |
| P1-08 | SCREEN-волны + дубль в отеле | **не сделано** | В `era-hotel-pms/prisma/schema.prisma` по-прежнему `MedicalAlert`, `MedicalOrder`, `LabResult`, `MedicalProcedure`, `ProcedureAppointment`. UAT/DoD не смотрел. |
| P1-09 | Лист ожидания, серии, группы | **частично** | `WaitlistEntry` + CRUD + `app/admin/waitlist`. Нет предложения из листа при отмене слота, нет повторных и групповых записей. `patchWaitlistEntry` обновляет по `id` без явного `organizationId` (рассчитывает на tenant-extension). |
| P1-10 | HL7 / анализаторы | **не сделано** | `src/integration/lis/README.md`: STUB. Есть только CSV / `HL7_FRAGMENT` в профиле файла, слушателя MLLP нет. |
| P1-11 | Аналитика клиники | **частично** | `computeClinicKpis` считает только явки/неявки. На домашнюю страницу не повешен (grep по `app/page.tsx` / `OpsHomeDashboard` пустой). Нет загрузки врачей, конверсии онлайн-записи, LTV, выгрузки XLSX. |

### P2

Все **не сделано** в заявленном объёме:

| ID | Тема | Комментарий по коду |
|---|---|---|
| P2-01 | Операционный блок | Нет. |
| P2-02 | eMAR со сканом браслета | Есть только отметка `OrderAdministration` без QR/штрихкода и без проверки, что статус был `DUE`. |
| P2-03 | Стоимость случая / DRG | По-прежнему только койко-день. |
| P2-04 | Пресет `wellness` | Константа и пункт навигации `mod:wellness` есть, но `presetsRequiredForPath` по-прежнему не гейтит ни одного пути `wellness` (`clinic-presets.ts`). |
| P2-05 | Приложение гостя | Нет. |
| P2-06 | Публичное API / вебхуки | Нет OpenAPI. Публиты только booking. |
| P2-07 | FHIR-фасад | Нет. |
| P2-08 | Стоматология | Нет. |
| P2-09 | RFID / СКУД | Нет (QR как был). |
| P2-10 | Маркетинг через CRM | В клинике нет. |

---

## 2. Новые баги в изменённом коде

1. **Двойная запись на слот (P0-06).** `detectSchedulingConflict` и `createScheduledBookingAppointment` идут подряд, без транзакции и без unique `(practitionerId, scheduledAt)`. Два параллельных POST могут занять одно время.
2. **Предсказуемая открытая комната Jitsi (P1-02, PHI).** Дефолт `meet.jit.si`, имя комнаты из org prefix + id записи, URL в query `/telehealth?room=`, на странице печатается целиком, не истекает. Любой, кто знает или переберёт id, войдёт в видеоприём.
3. **Токен портала в query string (P1-01, PHI).** `GET /api/portal/session?token=` — токен попадает в access-логи, историю браузера, Referer.
4. **Событие рецепта раньше аптеки (P1-04).** `dispatchSatelliteEvent` до `fetch` в очередь; при 502 событие уже ушло, строки рецепта нет.
5. **`Visit.payerKind` не выставляется при визите по направлению (P1-03).** Реестр İTS/ДМС фильтрует визиты по `payerKind in ITS/DMS/CORPORATE`, но этот признак при создании/закрытии визита не пишется.
6. **Срок e-Tabib — 10 календарных дней и дата из UTC (P1-03).** В плане были 10 рабочих дней.
7. **Выписка без эпикриза (P0-05).** `dischargeAdmission` не смотрит `ClinicalNote` kind `DISCHARGE_SUMMARY`.
8. **MAR: check-then-create без обработки unique (P0-05).** `generateMarAdministrationsForOrganization` проверяет существование и создаёт вне одной транзакции; уникальный `orderId_scheduledAt` есть, но нарушение уронит cron. Отметка `markAdministration` не проверяет текущий статус `DUE` (можно переписать уже `GIVEN`). Расходник при `GIVEN` в outbox не уходит.
9. **Нет UI у готового стационарного API (P0-05).** Витальные, назначения, отказ в госпитализации, лечащий врач есть в контроллерах, на `/inpatient` не используются. Выбор пациента всё ещё `pageSize=100`.
10. **Согласие не стоит на клинических действиях (P1-05).** Эндпоинт проверки есть, процедуры его не вызывают; `signed: true` принимается от сотрудника.
11. **Деньги через `Number()`.** В `visits__id_complete.controller.ts` (`amountNet`) и в отчёте страховки. В БД Decimal, в логике — float. Для сумм счёта это по-прежнему риск округления.
12. **Приём как успех через `HttpException(..., 201)`** в booking и inpatient admit. Если общий фильтр считает любой `HttpException` ошибкой, клиент получит ложный fail при успешном создании.

Регрессий в смысле «раньше работало, теперь сломано» по просмотренным файлам не видно.

---

## 3. Что ещё стоит знать

- Tenant-extension на Prisma, скорее всего, подмешивает `organizationId` в запросы. Явных выборок «по id без org» в новом коде несколько (`patchWaitlistEntry`, `patchDietTable`, подпись заметки). Это приемлемо только пока extension включён на всех путях.
- `session.userId` в `transferAdmission` может быть `undefined`, если в сессии поле называется `sub`.
- Рабочий стол врача для лабораторий берёт до 200 готовых заказов на всех пациентов дня глобальным `take: 200` — при большой выборке флаги части пациентов потеряются.

---

## Сноска про документы

Оценка честности PRD (P0-01) по коду не делалась. Файл анализа разрезан на `docs/adr/clinic/*`. В этой папке за сегодня появились короткие ADR (`clinic-clinical-notes.md`, `clinic-inpatient-mvp.md`, `clinic-portal-v2.md`, `clinic-telehealth-jitsi.md`, `clinic-its-insurance-adapters.md`) — это описания новых кусков, не замена исходного ТЗ.
