# ERA Sanatorium v-next — план доработок

Архитектурные решения зафиксированы в [ADR: sanatorium-vnext](./adr/sanatorium-vnext.md). Здесь — роадмап по волнам и детальная разбивка **Волны 1** (приоритет — UX клиники).

Затрагиваемые компоненты: `era-clinic`, `era-hotel-pms`, `era-orchestrator`, `packages/era-contracts`, `packages/satellite-kit`, новый `packages/era-fiscal`. **`era-data-hub` не меняется.**

## Принципы (кратко)

1. *Publish-to-bus, not-to-sibling* — сателлит публикует события в оркестратор, не зная подписчиков.
2. Адаптеры на краю — `finance-core` и `external/1С` равноправны.
3. Маршрутизация по entitlements решается оркестратором.
4. Сага — только B2C-путёвка; остальное хореография.
5. Один клинический движок (клиника) для in-house и walk-in; отличие — `patientOrigin` + цель биллинга.
6. Identity/QR на оркестраторе; Data Hub read-only.

---

## Волны

| Волна | Содержание | Зависит от |
|-------|------------|------------|
| **0 — Фундамент** | контракты + identity-резолвер + QR + `patientOrigin` + контракт `AccountingAdapter` | — |
| **1 — UX клиники** *(приоритет)* | Smart Scheduler + check-in, карточка визита/CPOE-UI + МКБ, рабочие места врача/медсестры, безопасный портал + виджет, живой sync каталога, касса (`@era/fiscal`) | Волна 0 (минимально) |
| **2 — Кросс-санаторий** | lifecycle-события отеля, origin-routing на folio, Sanatorium Scheduler, Program Templates + квота, retail reserve/write-off, QR в деле | Волны 0, 1 |
| **3 — Декаплинг/чистка** | удаление медконтура отеля, `external/1С` adapter, сага B2C-путёвки | Волны 1, 2 |

**Future / Backlog:** режим `hold` (предавторизация) + политика `deposit\|hold\|none` (SV9); отдельный `era-spa-pos` (SV8); мед-справочники/UoM в Data Hub (без гостевого профиля).

---

## Волна 0 — Фундамент (минимально, раньше всех)

| # | Задача | Где |
|---|--------|-----|
| 0.1 | Новые типы событий + расширение envelope полем `globalPersonId`; type-guards + `isSatelliteEvent()` | `packages/era-contracts/src/events/` (`common.ts`, `hotel.events.ts`, `clinic.events.ts`, `retail.events.ts`, `satellite-event.ts`) |
| 0.2 | Identity-резолвер `resolve-or-create person` по FIN/паспорт/телефон поверх `GlobalNaturalPerson` | `era-orchestrator` MDM модуль (`internal/v1/mdm/*`); клиент в `packages/satellite-kit` (рядом с `lookupGlobalPersonByFin`) |
| 0.3 | Выпуск/верификация **единого QR** (подписанный токен → `globalPersonId`) | `era-orchestrator` + helper в `packages/satellite-kit` |
| 0.4 | Контракт `AccountingAdapter` (начисление/выручка/инвойс) — интерфейс + дефолтная реализация `finance-core`-подписчика | `packages/era-contracts` (типы) + `era-finance-core/apps/api/src/integration/*` |
| 0.5 | `patientOrigin` (`WALK_IN`\|`IN_HOUSE`) + поле цели биллинга | `era-clinic/prisma/schema.prisma` (`Visit`/`ClinicalEpisode`) + миграция |

---

## Волна 1 — UX клиники (детально)

Порядок задач — по зависимости: расписание → рабочие места → наружу.

### 1.1 Smart Scheduler + реальный check-in
- **Модель ресурсов:** врач + кабинет + оборудование (ограничение «один УЗИ на три кабинета»). Новые сущности `Resource`/`ResourceType`/`ResourceBooking` (или расширить `Practitioner`/`Bed` паттерн).
  - `era-clinic/prisma/schema.prisma`
- **Слоты по реальной доступности** вместо stub-грида 9:00–17:00.
  - заменить `era-clinic/app/api/scheduling/slots/route.ts:10-60`
- **Drag-перенос в UI** (сейчас текстовая заглушка).
  - `era-clinic/app/scheduling/page.tsx` (см. `:105`), `era-clinic/app/api/appointments/[id]/reschedule/route.ts`
- **Статусы визита + реальный check-in** (`SCHEDULED → CHECKED_IN → IN_PROGRESS → COMPLETED → NO_SHOW`).
  - `Appointment.status` сейчас только `SCHEDULED` (`era-clinic/prisma/schema.prisma:66`)

### 1.2 Карточка визита + CPOE-UI + МКБ-10
- **UI карточки визита** (сейчас `/appointments` — плейсхолдер `app/appointments/page.tsx:21-23`) поверх существующих API.
- **CPOE-UI** на существующие модели `CpoeEntry`/`ClinicalTemplate` (`schema.prisma:185-231`); API `POST /api/visits/[id]/cpoe` уже есть.
- **Динамические шаблоны осмотров** по специальностям (используя `ClinicalTemplate`).
- **Каталог МКБ-10** вместо free-text `ClinicalDiagnosis.icdCode` (`schema.prisma:154-162`).

### 1.3 Рабочие места врача и медсестры (роль-роутинг)
- Подключить роли `DOCTOR`/`NURSE` (описаны в `PRD.md:58`, но не привязаны к маршрутам) к route-guard.
  - `era-clinic/middleware.ts`, `era-clinic/src/lib/api-utils.ts:44-58`
- **Врач:** очередь приёма, карточка визита, назначения (CPOE).
- **Медсестра:** очередь процедур на сегодня, отметка «выполнено» (триггер `PROCEDURE_COMPLETED` — Волна 2).

### 1.4 Безопасный портал пациента + виджет онлайн-записи
- **Валидация токена портала** — закрыть уязвимость: сейчас `app/api/portal/session/route.ts:9-27` не валидирует токен и отдаёт произвольные визиты.
- **Виджет онлайн-записи** как тонкий фронт над platform-booking оркестратора (переиспользуем `createBookingSlot/Appointment` из `@era/satellite-kit`, а не строим отдельную подсистему).
- Депозит — через payment link (политика `deposit`, SV9).

### 1.5 Живой sync каталога услуг
- Заменить ручной stub на pull из Finance/Data Hub.
  - `era-clinic/app/api/catalog/sync/route.ts:15`, кэш `ServiceCatalogCache`

### 1.6 Касса клиники + общий фискальный пакет
- **Новый пакет `packages/era-fiscal`** — единый интерфейс `fiscalize(...)` + провайдеры `mock | nbc | cybernet` + единый env. Сейчас фискалка дублируется в трёх местах с разошедшимися интерфейсами:
  - `era-hotel-pms/src/lib/compliance/fiscal-provider.ts` (`fiscalizePayment` → `receiptId`)
  - `era-retail-pos/src/lib/fiscal-provider.ts` (`fiscalizeReceipt` → `fiscalNumber`)
  - `era-fnb-pos/src/lib/kkm/*` (`fiscalize` → `receiptId,driver`, env `KKM_DRIVER`)
- **Мигрировать все POS-сателлиты** (hotel, retail, fb-pos) + новый кассовый узел клиники на `@era/fiscal` (SV7).
- **Касса встроена в UI клиники** (регистратор не выходит в POS); деньги уходят через `AccountingAdapter` (Волна 0).
- **Правило SV14:** фискализация в точке расчёта, без двойной фискализации (`IN_HOUSE` → отель, `WALK_IN` → касса клиники).

---

## Волна 2 — Кросс-сателлитный санаторий

| # | Задача | Где |
|---|--------|-----|
| 2.1 | Эмит lifecycle-событий отеля (`GUEST_CHECKED_IN/OUT`, `ROOM_CHANGED`) на шину | `era-hotel-pms/src/lib/integration/event-types.ts`, `event-dispatcher.ts`, `reservation.service.ts`, `checkout.service.ts`, `reservation-relocate.service.ts` |
| 2.2 | Origin-маршрутизация биллинга клиники: `WALK_IN`→Accounting, `IN_HOUSE`→folio | `era-clinic/app/api/visits/[id]/complete/route.ts` |
| 2.3 | Обобщить `room-charge` под любой сателлит-источник (gateway `POST_FOLIO_CHARGE`) | `era-hotel-pms/app/api/pos/room-charge/route.ts` |
| 2.4 | **Sanatorium Scheduler** — авто-раскладка программы по слотам с ограничениями («массаж не сразу после обеда», не ставить УЗИ на ужин — блокаторы) | `era-clinic` (новый сервис планирования) |
| 2.5 | **Program Templates + квота/баланс процедур** (Ф.2); инстанцирование по `programCode` из lifecycle-события | `era-clinic` + `RatePlan.programCode` в `era-hotel-pms` |
| 2.6 | **Retail reserve** (`PRESCRIPTION_ISSUED` → корзина/бронь, request-reply) | `era-clinic` + `era-retail-pos` + gateway |
| 2.7 | **Retail write-off** (`PROCEDURE_COMPLETED` → списание расходников по образцу FB) | `era-clinic` + `era-retail-pos` (`packages/era-contracts/src/events/fb.events.ts` как образец) |
| 2.8 | Единый QR в деле (ресепшен/медсестра/F&B) | потребители `globalPersonId` |
| 2.9 | Мигрировать `notifyClinicCheckIn` (прямой HTTP) на lifecycle-событие шины | `era-hotel-pms/src/lib/services/reservation.service.ts:229-257` |

---

## Волна 3 — Декаплинг и чистка

| # | Задача | Где |
|---|--------|-----|
| 3.1 | **Удалить медконтур отеля**: `MedicalAlert`, `MedicalOrder`, `LabResult`, `ProcedureService`, `ProcedureAppointment` + UI `/medical`, `/procedures`. Оставить `RatePlan.medicalFlag`, `RatePlanPackageLine`, `programCode` | `era-hotel-pms/prisma/schema.prisma`, `app/medical/*`, `app/procedures/*`, сервисы |
| 3.2 | **`external/1С` AccountingAdapter** — подписчик-коннектор | новый компонент/адаптер |
| 3.3 | **Сага B2C-путёвки** (process-manager): номер + программа + депозит, с компенсацией | `era-orchestrator` |
| 3.4 | SPA → preset `wellness` клиники (SV8) | `era-clinic` preset + перенос `SPA_CABIN`-ресурсов |

---

## Future / Backlog

- **`hold` (предавторизация)** + политика `deposit\|hold\|none` на объект (SV9): двухстадийный эквайринг, модель авторизаций `AUTHORIZED/CAPTURED/VOIDED/EXPIRED`, таймеры, частичный capture, auto-release; проработка международного эквайринга.
- **Единый `@era/fiscal` + реальный НБК/КИЗ KKM** — в Волне 1 делаем унификацию пакета (mock/stub), а **production-драйвер НБК** реализуем один раз в `@era/fiscal` (частично отмечено в `era-hotel-pms/doc/BACKLOG-PRODUCTION.md`).
- **`era-spa-pos`** как отдельный сателлит — при сильном спросе на чисто-бьюти функции.
- **Мед-справочники/UoM в Data Hub** (без гостевого профиля).

---

## Открытые мелочи (решать по ходу)

- Глубина модели ресурсов/оборудования в Scheduler.
- Источник каталога МКБ-10 (внутренний seed vs внешний).
- Миграция существующих санаторных эпизодов (созданных через HTTP-мост) на новую модель.
- Координация релизов сателлитов (CI/CD) — см. [PRODUCT_VERSIONING.md](./PRODUCT_VERSIONING.md), [CI_CD.md](./CI_CD.md).
