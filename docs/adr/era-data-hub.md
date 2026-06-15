# ADR: ERA Data Hub (Reference Data / DaaS)

## Status

Accepted — **Pass 2** 2026-06-02 (Phase 1 cutover path, CBAR ingest, S8 cache). Домен: **`data.era-365.online`**. Реализация: [era-data-hub/doc/DELIVERY-DATA-HUB.md](../../era-data-hub/doc/DELIVERY-DATA-HUB.md) · планы: [Pass 1](../../.cursor/plans/era_data_hub_p1_6337429e.plan.md) · [Pass 2](../../.cursor/plans/era_data_hub_pass_2_7f78d60e.plan.md).

Связано: [PLATFORM_ADDONS.md](../PLATFORM_ADDONS.md) · [CONTROL_PLANE_ARCHITECTURE.md](../CONTROL_PLANE_ARCHITECTURE.md) · [reference-data-ecosystem](./reference-data-ecosystem.md) · [orchestrator-satellite-vs-module](./orchestrator-satellite-vs-module.md) · [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md) · [fx-rates-ecosystem](./fx-rates-ecosystem.md) (CBAR FX contract) · [production-calendar-ecosystem](./production-calendar-ecosystem.md) (AZ prod calendar).

## Контекст

Справочные данные (курсы валют, коды ВЭД, реквизиты компаний, банки/филиалы, гео, единицы измерения, налоговые ставки, план счетов) сегодня частично реализованы **внутри `era-finance-core`**:

- `CbarOfficialRate` + модуль `apps/api/src/fx/*` — курсы ЦБА с историей и статусами `PRELIMINARY/FINAL`.
- `CustomsTariffRate` + модуль `apps/api/src/customs/*` — effective-dated ставки пошлин/НДС/акциза по HS-кодам.
- `GlobalCompanyDirectory` + `apps/api/src/global-directory/*` — реестр компаний по VÖEN (MDM).
- `BankGlossary` / `BankBranch` + `catalog/bank/bank-branches.generated.ts` — банки и филиалы (MFO, SWIFT, телефоны, адреса).
- `iban.util.ts` (чистая валидация) + `IbanValidationService` (Redis-кэш + внешний провайдер) в `apps/api/src/banking/*`.
- Seeds: `geo/countries.ts`, `geo/cities.ts`, `trade/units-of-measure.ts`, `trade/customs-law-uom-mapping.json`, `national/tax-rates.ts`, `catalog/national/chart-of-accounts-*.json`.

Эти данные по природе **глобальные, read-only, версионируемые по дате и сильно кешируемые**. Раздача их тысячам внешних потребителей напрямую из финядра создаёт паразитную нагрузку на основную БД (DDoS-эффект на ERP-клиентов) и расширяет поверхность атаки. Это отдельный bounded-context.

## Решение

Выделить **`era-data-hub`** — самостоятельный read-only сервис (Reference Data / Data-as-a-Service), публикуемый наружу как продукт **`platform_reference_data`** с биллингом/метерингом на оркестраторе. `era-finance-core` и сателлиты становятся его **потребителями** (с локальным кэшем).

> Терминологическая оговорка: это **не industry-сателлит** (`industry_*`) по таксономии [orchestrator-satellite-vs-module](./orchestrator-satellite-vs-module.md), а горизонтальный инфраструктурный продукт-`ADDON`. В `pricing_modules` заводится `catalog_kind = ADDON`.

### Сквозные архитектурные решения (утверждены)

| Код | Решение |
|-----|---------|
| S1 | Отдельный сервис `era-data-hub`, не в финядре |
| S2 | PostgreSQL + Redis-кэш. Фаза 0 — **только RO-реплика** финядра (не основная БД); Фаза 1+ — собственная БД хаба (см. D1) |
| S3 | Наружу через Traefik на `data.era-365.online` |
| S4 | Внутри ERA — по `era-network` (без публичного хопа) |
| S5 | Жёсткое версионирование `/registry/v1/` |
| S6 | Auth: API-ключ (внешние) + сервис-токен (свои) |
| S7 | Биллинг/метеринг вызовов на оркестраторе, продукт `platform_reference_data` |
| S8 | Кэш: история — `immutable`, текущий день — короткий TTL |
| S9 | Финядро → потребитель (с локальным кэшем), поэтапно |
| S10 | Полка `C` (№6, 14, 24) — отдельная фаза + юр.проверка редистрибуции/PII |

## Scope

**Легенда готовности:** 🟢 почти готово (нужен только API) · 🟡 половина есть · 🟠 зачаток/данные · 🔴 с нуля.
**Полка:** `M` — массовый дешёвый API · `C` — compliance/премиум (юр.риски + PII).

### Включено (22 справочника)

| № | Справочник | Готовн. | Полка | Источник в коде (сейчас) |
|---|------------|---------|-------|--------------------------|
| 1 | Курсы валют + история | 🟢 | M | `fx/*`, `CbarOfficialRate` |
| 2 | Производственный календарь АР | 🟠 | M | `hr/calendar/az-2026.ts` |
| 3 | Коды ВЭД (HS) + тарифы | 🟡 | M | `customs/*`, `CustomsTariffRate`, `seeds/trade/hs-codes.ts` |
| 4 | Коды видов деятельности ГНС | 🔴 | M | — |
| 5 | Коды услуг налоговой | 🔴 | M | — |
| 6 | Реестр реквизитов компаний (VÖEN) | 🟡 | **C** | `global-directory/*`, `GlobalCompanyDirectory` |
| 7 | Банки и филиалы | 🟡 | M | `BankGlossary`, `BankBranch`, `bank-branches.generated.ts` |
| 8 | Валидация/декодинг IBAN | 🟠 | M | `banking/iban.util.ts`, `iban-validation.service.ts` |
| 9 | Адресный классификатор | 🟢 | M | `seeds/geo/countries.ts`, `cities.ts` |
| 10 | Единицы измерения + маппинг таможни | 🟢 | M | `UnitOfMeasure`, `customs-law-uom-mapping.json` |
| 11 | Налоговые ставки на дату | 🟡 | M | `TaxRate`, `seeds/national/tax-rates.ts` |
| 12 | Единый план счетов БУ АР | 🟢 | M | `catalog/national/chart-of-accounts-*.json` |
| 13 | Ставка рефинансирования ЦБА | 🔴 | M | — |
| 14 | Реестр плательщиков НДС / статус | 🔴 | **C** | — |
| 15 | Мин. зарплата / прож. минимум / коэф. | 🔴 | M | — |
| 18 | UN/LOCODE | 🔴 | M | — |
| 19 | Таможенные посты и погранпереходы АР | 🔴 | M | — |
| 20 | INCOTERMS 2010/2020 | 🔴 | M | — |
| 21 | Нормы амортизации по классам активов | 🟠 | M | связано с `fixed-assets` |
| 22 | Типы/статусы e-Qaimə | 🔴 | M | — |
| 23 | AZPOST почтовые индексы | 🔴 | M | расширение №9 |
| 24 | Санкционный скрининг OFAC/EU/UN | 🔴 | **C** | — |

### Отложено (вне текущего scope)

- **№16. Телефонные коды операторов / валидация** — вернуться при развитии `platform_notifications`.
- **№17. Календари соседних стран (TR/GE/RU)** — расширение №2 на будущее.

### Приоритизация

- **P1 (первая волна):** 1, 2, 3, 6, 7, 8, 12.
- **P2:** 9, 10, 11, 13, 14, 15.
- **P3:** 4, 5, 18, 19, 20, 21, 22, 23, 24.
- **Пилот (последовательность):** **1 (курсы) → 7+8 (банки/IBAN) → 6 (VÖEN)**.

## Архитектура сервиса

```
[Внешние клиенты] --HTTPS--> Traefik (data.era-365.online)
                                  │  (API-ключ, rate-limit, метеринг)
                                  ▼
                          era-data-hub (read API, /registry/v1)
                          ├─ Redis (горячий кэш, ETag/TTL)
                          └─ PostgreSQL (reference, system of record)
                                  ▲
   era-finance-core / era-hotel-pms / era-fb-pos
                 --era-network (сервис-токен, internal DNS era-data-hub:PORT)-->
                                  ▲
   Ingest workers (cron): ЦБА XML, тарифы ГНС/таможни, гео, e-taxes, санкц.списки …
   Оркестратор: продукт platform_reference_data — ключи, метеринг, биллинг (CP)
```

## Конвенции API

- База (внешняя): `https://data.era-365.online/registry/v1/…`
- База (внутренняя): `http://era-data-hub:PORT/registry/v1/…` по `era-network`.
- Каждый ответ содержит метаданные качества: `asOf`, `source`, `version`.
- Кеш: исторические записи — `Cache-Control: immutable`; текущие — короткий TTL + `ETag`.
- Ошибки: единый JSON-формат `{ code, message }`; жёсткая обратная совместимость в пределах `v1`.
- Пагинация: cursor-based для списков/деревьев.

### Эндпоинты P1

| № | Метод/путь | Назначение |
|---|------------|------------|
| 1 | `GET /fx/rates?date=&symbols=USD,EUR` | курсы на дату |
| 1 | `GET /fx/rates/range?from=&to=&symbol=` | ряд для графиков |
| 1 | `GET /fx/convert?from=&to=&amount=&date=` | конвертация через AZN |
| 2 | `GET /calendar/az/is-working-day?date=` | рабочий день? |
| 2 | `GET /calendar/az/add-business-days?date=&n=` | срок +N рабочих дней |
| 3 | `GET /hs/{code}` · `GET /hs/{code}/tariff?date=` | HS-узел + ставки на дату |
| 6 | `GET /companies/{voen}` | реквизиты по VÖEN (полка C) |
| 7 | `GET /banks` · `GET /banks/branches/{code}` | банки/филиалы (FK по VÖEN) |
| 8 | `GET /iban/validate?iban=` | контроль + резолв банка/филиала |
| 12 | `GET /chart-of-accounts?profile=commercial` | план счетов (3 языка) |

## Части, которые нужно отделить от ядра (детально)

Главный принцип выноса — паттерн **expand/contract** (расшири, затем сожми): сначала `era-data-hub` становится **владельцем (system of record)** данных, финядро через адаптер начинает читать из него, и только потом из финядра удаляются ingest-логика и таблицы. Никаких «больших взрывов».

Для каждого компонента ниже: **что переезжает** (владение данными + ingest), **что остаётся в ядре** (бизнес-потребление) и **как режется граница**.

### 1. Курсы валют (`fx`) — P1, флагман

**Переезжает в `era-data-hub`:**

- Таблица `CbarOfficialRate` (schema.prisma) — становится system of record в БД хаба.
- Ingest: `apps/api/src/fx/cbar-fx.service.ts` (HTTP/XML-парсер ЦБА), `cbar-rate-sync.service.ts` (логика `PRELIMINARY→FINAL`, upsert), `cbar-rate-sync.cron.ts` (расписание).
- Публичная выдача: `getFinalOfficialAznPerUnit`, `getLatestFromDbForCode`, `resolveDashboardRates` → как эндпоинты `/registry/v1/fx/*`.

**Остаётся в `era-finance-core` (потребление):**

- `fx/currency-converter.service.ts` и `fx/fx-revaluation.service.ts` / `fx-revaluation.cron.ts` — это **бизнес-логика учёта** (переоценка валютных остатков, проводки). Они должны **получать курс**, но не **добывать** его.
- `fx/fx.controller.ts` / `fx-dashboard.types.ts` — UI-дашборд финядра (может проксировать хаб или показывать локальный кэш).

**Граница:** ввести в ядре тонкий `FxRateClient` (HTTP к хабу + локальный кэш в `cbar_official_rates` как read-through). На переходный период `getFinalOfficialAznPerUnit` читает локальную копию; источником наполнения вместо `cbar-rate-sync.cron` становится хаб.

### 2. Производственный календарь — P1

**Переезжает / создаётся в хабе:**

- Сейчас это **хардкод** `apps/api/src/hr/calendar/az-2026.ts` (множество ISO-дат на один год) — это техдолг, не справочник. В хабе создаётся таблица `calendar_day` (или `holiday` + генератор) с многолетней историей и будущими годами, типом дня (выходной/праздник/перенос/сокращённый), регионом и источником.

**Остаётся в ядре:**

- `hr/timesheet.service.ts`, `hr/absences.service.ts`, `hr/payroll-month-calendar.ts` — расчётная логика (коэффициент 30.4, рабочие дни для отпусков). Они продолжают спрашивать «рабочий ли день», но через клиент хаба.

**Граница:** заменить `isAzWorkingDay(year, m, d)` на вызов `CalendarClient.isWorkingDay(country, date)` (с локальным кэшем на год). Старый `az-2026.ts` удаляется после переключения.

### 3. Коды ВЭД (HS) + тарифы (`customs`) — P1

**Переезжает в хаб:**

- Таблица `CustomsTariffRate` (effective-dated ставки — уже правильная модель с историей).
- Словарь HS: `seeds/trade/hs-codes.ts`, `catalog/trade/customs-tariff-rates.json`, `catalog/trade/customs-law-uom-mapping.json`.
- Сервис ставок и поддержка качества: `customs/customs-tariff-rates.service.ts`, `customs-tariff-rate-dedupe.ts`, lookup-pipeline.

**Остаётся в ядре (важно — это НЕ справочник, а операции):**

- `customs/customs.service.ts` (декларации БГД организации — per-tenant), `customs-tax-calculator.service.ts` (GATT-калькулятор), `customs.controller.ts`, DTO. Калькулятор **берёт ставку на дату** из хаба, но сами декларации, проводки и связь с закупками остаются в финядре.

**Граница:** `customs-tax-calculator.service.ts` уже вызывает `computeLines(items, date)` с резолвом ставки — заменить внутренний резолвер на `TariffRateClient.getRate(hsCode, date)`. Разделить два понятия: **«словарь HS + ставки»** (хаб) и **«ставка на дату» как функция** (клиент).

### 6. Реестр реквизитов компаний (VÖEN) — P1, полка C

**Переезжает в хаб:**

- Таблица `GlobalCompanyDirectory` (MDM) → system of record в хабе.
- Сервис `global-directory/global-company-directory.service.ts` (`upsert`, `findByTaxId`, `scheduleUpsert`).

**Остаётся в ядре:**

- Карточки контрагентов организации (`counterparties/*`) — это **per-tenant** данные, не глобальный справочник. Они продолжают «обогащать» хаб (publish событие/`scheduleUpsert` через клиент) и читать из него для автозаполнения.

**Граница и риск (S10):** наружу публикуется только после юр.проверки права на редистрибуцию. Персональные поля (`directorName`, `phone`) проксируются через `privacy/data-masking.service.ts`; фирмографика (название, форма, адрес) и PII разделяются по тарифу. Наполнение «попутно из операций» (`scheduleUpsert`) остаётся, но как клиентский вызов хаба.

### 7 + 8. Банки/филиалы и IBAN — P1

**Переезжает в хаб:**

- Таблицы `BankGlossary` (банк-родитель) и `BankBranch` (MFO `branchCode`, `swift`, `phones`, `address`, `isHeadOffice`).
- Генератор справочника: `catalog/bank/bank-branches.generated.ts` + `db:gen:banks-branches-seed`.
- Чистая валидация: `banking/iban.util.ts` (`validateAzIban` — без побочных эффектов) и резолв «branchCode → банк/филиал/SWIFT».

**Остаётся в ядре:**

- `OrganizationBankAccount` (счета **конкретной** организации) — per-tenant; хранит только IBAN + **FK на филиал** из справочника хаба.
- `IbanValidationService` (внешний провайдер iban.com, аудит, организационный кэш) — это **операционная** валидация в контексте org; она может вызывать чистый `validateAzIban` из хаба, но платный внешний deep-lookup и аудит остаются в финядре.
- Весь модуль `banking/*` (синхронизация выписок, провайдеры ABB/Kapital/Pasha/Birbank, матчинг) — **операции**, не справочник; не трогаем.

**Граница (по вопросу «банки в реестре компаний или отдельно?» — отдельно):** банк = компания (есть VÖEN) и живёт в реестре №6; филиал — **отдельная сущность** `BankBranch` со ссылкой на банк по VÖEN. `/registry/v1/banks/branches/{code}` при отдаче джойнит банк-компанию из №6. Реквизиты клиента хранят только IBAN + FK на филиал — без дублирования адреса/телефона головного офиса.

### 12. Единый план счетов БУ АР — P1

**Переезжает в хаб:** статические каталоги `catalog/national/chart-of-accounts-{commercial,ngo,budget}.json` как **эталонный шаблон** (read-only).

**Остаётся в ядре:** материализованный план счетов **организации** (`ChartOfAccounts`/`Account` per-tenant) — это рабочие данные с проводками. Хаб отдаёт только эталон для онбординга/сверки.

### P2/P3 — без зависимостей от ядра

№9 (geo), №10 (UoM), №11 (tax rates) — копируются из seeds в хаб как новые справочники; в ядре остаются их потребители (формы, налоговые расчёты) на клиенте хаба. №4, 5, 13, 14, 15, 18, 19, 20, 21, 22, 23, 24 — наполняются в хабе с нуля (ingest из ГНС/таможни/внешних списков), у ядра зависимостей нет.

### Что НЕ выносим (явно остаётся в финядре)

- Любые **per-tenant** данные: декларации БГД, счета организаций, выписки, проводки, переоценка, карточки контрагентов.
- Интеграционные адаптеры банков и платёжные провайдеры (`banking/bank-providers/*`, `bank-adapters/*`).
- Бизнес-калькуляторы (GATT, payroll, FX-revaluation) — они **потребляют** справочник, но содержат учётную логику ядра.

## Модель владения данными (S9, фазами)

1. **Фаза 0 — фасад:** `era-data-hub` поднимается и читает справочные модели финядра **только через RO-реплику (read-only)** — см. решение **D1** ниже. Прямые запросы в основную транзакционную БД финядра **запрещены**. Новые таблицы (`calendar_day`, классификаторы) хаб держит в собственной БД. Внешний API `/registry/v1/*` уже публикуется. Ingest-логику (CBAR-cron, кастомс-сиды, bank-seed) переиспользуем как есть.
2. **Фаза 1 — вынос владения (Pass 2 implemented):** `npm run db:sync-from-finance`, `ERA_DATA_HUB_DATA_SOURCE=hub`, CBAR cron writes `era_data_hub`; Redis `ETag`/`Cache-Control` (S8); finance `DataHubClientService` + customs tariff resolve; orchestrator `validate-key`. Финядро: `ERA_DATA_HUB_ENABLED`, `ERA_DATA_HUB_FINANCE_CBAR_INGEST_DISABLED`.
3. **Фаза 2 — сжатие:** из финядра удаляются ingest-cron и (где безопасно) дублирующие таблицы; остаются только локальные кэши.

## Полка C (S10) — отдельный режим

№6, 14, 24 — госданные/PII. До публикации наружу: подтвердить **право на редистрибуцию** источника; подключить `privacy/data-masking.service.ts`; разделить фирмографику (можно) и персональные поля (директор/телефон — с осторожностью); отдельный премиальный тариф и согласие/договор с клиентом API.

## Монетизация

- Каталог оркестратора: `platform_reference_data` (`catalog_kind = ADDON`).
- Внешним — API-ключи + планы по объёму вызовов (free/pro/enterprise), метеринг через существующий механизм квот/`accumulatedBalance`; полка `C` — премиум/по запросу.

## Зафиксированные решения

- **D1 — БД на Фазе 0: только RO-реплика финядра.** Внешний DaaS-трафик **не имеет права** идти в основную транзакционную БД, где считаются балансы и FIFO: иначе read-нагрузка тысяч внешних клиентов создаёт блокировки таблиц и риск деградации учётных операций. На Фазе 0 хаб подключается к **read-only реплике** (отдельная строка подключения, реплика отстаёт на секунды — для справочников допустимо). Запись/ingest на Фазе 0 продолжает идти в основную БД через существующие cron финядра; хаб реплику только читает. На Фазе 1 хаб получает **собственную БД** (system of record), и зависимость от реплики финядра снимается.

## Открытые вопросы

- Источник и периодичность ingest для №13/14/22 (порталы ГНС/e-taxes) и №24 (OFAC/EU/UN).
- Юридическая модель редистрибуции для полки `C`.
- Стек сервиса: NestJS (консистентно с финядром) vs лёгкий Fastify-сервис.

## Definition of Done (для реализации)

1. Сервис `era-data-hub` в монорепо + Docker Compose (`era-network` + Traefik label на `data.era-365.online`).
2. Prisma-схема хаба для P1 (`cbar_official_rates`, `calendar_day`, `customs_tariff_rates` + HS, `global_company_directory`, `bank_glossary`/`bank_branches`, `chart_of_accounts_template`).
3. Контракт `/registry/v1/*` (P1) + версионирование + кэш-заголовки.
4. Клиенты в финядре (`FxRateClient` и т.д.) + фича-флаг переключения источника.
5. Продукт `platform_reference_data` в каталоге оркестратора + выдача ключей + метеринг.
6. Cursor plan на реализацию; ссылка из [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md) и [IMPLEMENTATION_PLANS.md](../IMPLEMENTATION_PLANS.md).
