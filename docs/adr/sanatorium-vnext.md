# ADR: ERA Sanatorium v-next (Clinic ⊕ Hotel ⊕ Retail ⊕ Accounting)

## Status

Proposed — 2026-06-03. Доработки следующей версии по двум сателлитам (**`era-clinic`**, **`era-hotel-pms`**) и кросс-сателлитной интеграции через **`era-orchestrator`**. **`era-data-hub`** schema не меняется; **clinic scheduling** потребляет prod calendar read-only ([production-calendar-ecosystem.md](./production-calendar-ecosystem.md)).

Связано: [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md) · [satellite-finance-bridge-pattern](./satellite-finance-bridge-pattern.md) · [HOSPITALITY_FINANCE_BOUNDARY.md](../HOSPITALITY_FINANCE_BOUNDARY.md) · [orchestrator-satellite-vs-module](./orchestrator-satellite-vs-module.md) · [hotel-module-taxonomy](./hotel-module-taxonomy.md) · [clinic-product-lines-and-presets](./clinic-product-lines-and-presets.md) · [era-data-hub](./era-data-hub.md). План реализации: [SANATORIUM-VNEXT-PLAN.md](../SANATORIUM-VNEXT-PLAN.md).

## Контекст

Цель — режим **«Санаторий»**, собираемый из автономных сателлитов: гость отеля проходит лечение в клинике, расходники списываются со склада (`retail`), деньги учитываются ядром финансов **или внешним учётом (1С)**. При этом каждый сателлит должен оставаться лёгким и работать **по отдельности** (например, отель без нашего финядра; клиника «с улицы» без отеля).

Текущее состояние (аудит кода на 2026-06-03):

- **Оркестратор** — это control plane, а **не** event broker/saga. Он валидирует событие (`@era/contracts`) и кладёт в одну очередь BullMQ `era-satellite-events`; **единственный потребитель — `era-finance-core`**. Fan-out по нескольким потребителям, подписок, саг и компенсаций нет.
- **Кросс-связи идут прямыми HTTP-мостами.** Санаторный мост `hotel → clinic` — прямой HTTP `POST /api/sanatorium/episodes/from-stay` с `X-Clinic-Bridge-Secret` (`era-hotel-pms/src/lib/services/reservation.service.ts` → `notifyClinicCheckIn`).
- **Data Hub** — read-only справочники (CBAR FX, банки, HS, реестр юрлиц по VÖEN). Гостевой профиль/QR в нём вне scope. Профиль физлица (MDM по FIN) живёт **в оркестраторе** (`era_mdm/GlobalNaturalPerson`).
- **Folio отеля уже принимает внешние начисления** через POS-bridge `POST /api/pos/room-charge` (bridge secret, идемпотентность).
- **Medical packages в отеле уже есть** (`RatePlan.medicalFlag`, `RatePlanPackageLine`, ночная разноска бандла в night-audit), но **квоты/остатка процедур нет**.
- **В отеле есть собственный мини-медконтур** (`MedicalAlert`, `MedicalOrder`, `LabResult`, `ProcedureService`, `ProcedureAppointment`, SPA-as-medical), который **дублирует клинику**.
- **Клиника:** зрелые лаборатория + санаторные эпизоды + billing-события; но расписание/карточка визита/CPOE/рабочие места врача и медсестры/портал — частично или заглушки; интеграции с retail **нет**.
- **Pre-auth/hold в `finance-core` нет** (только payment link `PENDING/PAID/EXPIRED/CANCELLED`).
- **Единого QR гостя и `patientOrigin` (walk-in vs in-house) нет.**

### Состояние фискализации (KKM) — контекст для SV7/SV14

Фискалка есть в трёх POS-сателлитах как **три независимых копипаст-реализации** с разошедшимися интерфейсами; реальной интеграции НБК нет нигде (везде mock/stub).

| Сателлит | Фискалка | Реализация | Интерфейс |
|----------|----------|------------|-----------|
| `era-hotel-pms` | есть (mock/stub) | `src/lib/compliance/fiscal-provider.ts` — `MockKkmProvider`/`NbcKkmProviderStub`, env `ERA_FISCAL_PROVIDER` | `fiscalizePayment()` → `{ receiptId, qrPayload }` |
| `era-retail-pos` | есть (mock/stub) | `src/lib/fiscal-provider.ts` — `MockRetailKkm`/`NbcRetailKkmStub`, env `ERA_FISCAL_PROVIDER` | `fiscalizeReceipt()` → `{ fiscalNumber, qrPayload }` |
| `era-fnb-pos` | есть (mock) | `src/lib/kkm/*` — `MockKkmDriver`, env `KKM_DRIVER` | `fiscalize()` → `{ receiptId, qrPayload, driver }` |
| `era-clinic` | **нет** | — (касса появляется в этой версии, SV6/SV7) | — |
| auto / wholesale / construction / logistics / crm | нет | фискального кода нет | B2B/безнал — фискалка не требуется (SV14) |

## Решение

Достроить оркестратор до **брокера-медиатора с подключаемыми адаптерами** и собирать санаторий из автономных сателлитов. Прямые мосты мигрировать на шину.

### Сквозные архитектурные решения

| Код | Решение |
|-----|---------|
| **SV1** | **Модель интеграции C** — брокер-медиатор. Сателлит публикует доменные события в **одну** точку (шина оркестратора), не зная подписчиков (*publish-to-bus, not-to-sibling*). Хореография по умолчанию; **сага — точечно**, только для B2C-брони путёвки (номер + программа + депозит, с компенсацией). Прямые satellite↔satellite HTTP-мосты мигрируются на шину. |
| **SV2** | **`AccountingAdapter`** — единый контракт «начисление/выручка/инвойс» с двумя реализациями-подписчиками: `era-finance-core` и `external/1С`. Сателлит-издатель **не меняется** при замене учётной системы; выбор адаптера = конфигурация подписки. |
| **SV3** | **Identity/QR — на оркестраторе** поверх `era_mdm/GlobalNaturalPerson` (ключи FIN/паспорт/телефон). Резолвер `resolve-or-create person` + выпуск **единого QR гостя** (подписанный токен → `globalPersonId`). **Data Hub не трогаем** (остаётся read-only). |
| **SV4** | **Медконтур из `era-hotel-pms` удаляется полностью.** Санаторий = докупка сателлита `era-clinic`. Отель остаётся «номер + folio + бронь ресурсов». В отеле сохраняются только `RatePlan.medicalFlag` (триггер программы), `RatePlanPackageLine` (ночная разноска бандла на folio) и ссылка `programCode`. |
| **SV5** | **`patientOrigin` (`WALK_IN` \| `IN_HOUSE`)** в клинике + маршрутизация биллинга: `WALK_IN` → `AccountingAdapter`; `IN_HOUSE` → **folio отеля через обобщённый контракт `room-charge`** (новый API не вводим). Standalone-клиника без отеля — всегда `WALK_IN`. |
| **SV6** | **Один клинический движок.** При наличии `era-clinic` она — единственный владелец расписания/ЭМК/процедур/лаборатории для in-house и walk-in (общий календарь ресурсов: врач + кабинет + оборудование). |
| **SV7** | **Касса клиники встроена в UI клиники** (регистратор не выходит в отдельное POS). Фискальная механика (смены/чеки/фискализация/возвраты) выносится в **общий пакет `@era/fiscal`** с единым интерфейсом и провайдерами `mock \| nbc \| cybernet`, на который мигрируют **все POS-сателлиты** (hotel, retail, fb-pos) и новый кассовый узел клиники — вместо текущих трёх разошедшихся копий. Деньги клиника не учитывает — выручка/GL уходят через `AccountingAdapter`. Реальная интеграция НБК/КИЗ реализуется **один раз** в `@era/fiscal` (см. Future). |
| **SV8** | **SPA/wellness — preset (`wellness`) клиники** (по аналогии с `pharmacy`-preset в retail): расписание + ресурсы + лёгкая карточка, **без** EMR/МКБ. Отдельный `era-spa-pos` — только при сильном спросе позже. |
| **SV9** | **Платёжная политика — опция на объект: `deposit \| hold \| none`.** v1 — `deposit` (на существующем payment link). **`hold` (предавторизация)** — future-версия (требует двухстадийного эквайринга + модель авторизаций `AUTHORIZED/CAPTURED/VOIDED/EXPIRED` + таймеры/частичный capture/auto-release). Причина приоритезации `hold`: отели избегают депозита из-за дорогих/долгих рефандов (особенно международных). |
| **SV10** | **Lifecycle-события отеля на шину:** `SATELLITE_HOTEL_GUEST_CHECKED_IN`, `SATELLITE_HOTEL_GUEST_CHECKED_OUT`, `SATELLITE_HOTEL_ROOM_CHANGED`. Клиника реагирует переносом/отменой процедур при досрочном выезде/переселении. |
| **SV11** | **Treatment Program Templates + квота/баланс процедур — на стороне клиники.** Rate plan отеля несёт `programCode`; на check-in программа инстанцируется в клинике, которая считает остаток и при превышении квоты шлёт charge на folio (без двойной разноски). |
| **SV12** | **Split (2026-08-21).** **(a) Pharmacy / Rx** — later: `PRESCRIPTION_ISSUED` → retail request-reply reserve (not in Nafta now). **(b) Procedure TTK** — `PROCEDURE_COMPLETED` → **Finance inventory** write-off from clinic procedure BOM (not retail POS, not dummy `PROC-{code}`). See [clinic-procedure-consumable-ttk.md](./clinic-procedure-consumable-ttk.md). Folio/Accounting charge for the tariff stays SV5. |
| **SV13** | **PII/consent — жёсткая изоляция.** Отель **не** получает клинических данных (диагнозы/ЭМК) — только факт пребывания, номер и события «процедура сделана / charge». Клиника видит из отеля только даты пребывания и номер. Используется заготовка consent в `era_mdm`. |
| **SV14** | **Фискализация — в точке расчёта, без двойной фискализации.** Фискальный чек привязан к точке приёма денег у конечного потребителя, а не к каждому сателлиту. В санатории: для `IN_HOUSE` деньги собираются на ресепшене отеля при выезде → фискализирует **отель**, клиника только вешает charge на folio. Для `WALK_IN` → фискализирует **касса клиники**. Одни деньги фискализируются ровно один раз. B2B/безнал (logistics, construction, wholesale, crm) фискалки не требуют. |

### Sync vs async

- **Async (event-carried, шина):** факты/уведомления — `*_COMPLETED`, lifecycle, `PROCEDURE_COMPLETED`, `PRESCRIPTION_ISSUED`. Идемпотентны по `correlationId`.
- **Sync (request-reply через gateway оркестратора):** «есть препарат сейчас?», «забронируй слот/койку», «можно на folio?». Вызывающий не хардкодит адрес соседа — резолв через gateway/registry.
- **Saga (process-manager в оркестраторе):** только B2C-путёвка.

## Контракты событий (`@era/contracts`)

Добавляются (домены `identity`, расширение `hotel`/`clinic`/`retail`):

| Событие | Тип | Назначение |
|---------|-----|------------|
| `SATELLITE_HOTEL_GUEST_CHECKED_IN` | async | старт программы в клинике (несёт `globalPersonId`, `reservationId`, `roomNumber`, `programCode`, даты) |
| `SATELLITE_HOTEL_GUEST_CHECKED_OUT` | async | закрытие/перенос процедур (в т.ч. досрочно) |
| `SATELLITE_HOTEL_ROOM_CHANGED` | async | актуализация номера для folio-routing |
| `SATELLITE_CLINIC_PROCEDURE_COMPLETED` | async | retail write-off + charge на folio/Accounting |
| `SATELLITE_CLINIC_PRESCRIPTION_ISSUED` | async | сигнал retail на сборку заказа |
| (gateway) `RESERVE_STOCK` / `STOCK_CHECK` | sync | бронь/проверка препарата в retail |
| (gateway) `POST_FOLIO_CHARGE` | sync | обобщённый `room-charge` для любого сателлита-источника |

Envelope расширяется полем `globalPersonId`. Регистрация — как обычно: Zod-схема + type-guard + `isSatelliteEvent()` + хендлер/подписчик.

## Out of scope (этой версии)

- `hold`/предавторизация (см. SV9 — future).
- Отдельный `era-spa-pos` (см. SV8).
- Гостевой профиль/QR в Data Hub (см. SV3 — остаётся read-only).
- Полноценный HL7/FHIR/DICOM в клинике (как и прежде).
- **Реальная интеграция НБК/КИЗ KKM** — в этой версии только унификация в `@era/fiscal` (mock/stub сохраняются); production-драйвер НБК — future (см. [SANATORIUM-VNEXT-PLAN.md](../SANATORIUM-VNEXT-PLAN.md) § Future).

## Последствия

- **+** Сателлиты остаются автономными и собираются как кубики; замена финядра на 1С не трогает код сателлитов.
- **+** Единая точка наблюдаемости/идемпотентности/повторов на шине.
- **−** Требуется достроить оркестратор (подписки/fan-out, исходящая доставка не-Finance потребителям, sync-gateway, мини-сага) — это новый объём, ранее не существовавший.
- **−** Удаление медконтура отеля — миграция данных/UI; снимается дублирование, но ломает обратную совместимость для текущего «медицинского» отеля (требует развёртывания `era-clinic`).
