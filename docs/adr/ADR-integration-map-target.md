# ADR: целевая карта интеграций ERA 365

**Статус:** Accepted (целевая карта + долг)  
**Дата:** 2026-11-27  
**Контекст решения:** публичная схема архитектуры (главная era-365.online) и внутренний бэклог каналов. Схема, которая уже нравится (раунд t42u), расширяется до *целевой* архитектуры: сплошная линия = связь есть в коде, пунктир = запланировано / долг. Нереализованные рёбра не выдаются за живые.

**Связано:** [satellite-integration-channels.md](./satellite-integration-channels.md) · [satellite-finance-bridge-pattern.md](./satellite-finance-bridge-pattern.md) · [construction-satellite-gap-analysis.md](./construction-satellite-gap-analysis.md) · [construction-domain-boundaries.md](./construction-domain-boundaries.md) · [bank-satellite-gap-analysis.md](./bank-satellite-gap-analysis.md) · [BANK-AUDIT-2026-11-25-v4.md](../BANK-AUDIT-2026-11-25-v4.md) · [BANK-AUDIT-2026-11-25-v3.md](../BANK-AUDIT-2026-11-25-v3.md) · [era-data-hub.md](./era-data-hub.md) · [data-hub-construction-materials.md](./data-hub-construction-materials.md) · [workforce-timesheet-construction-bridge.md](./workforce-timesheet-construction-bridge.md) · [orchestrator-platform-integration-gateway.md](./orchestrator-platform-integration-gateway.md) · [crm/01-integrations-architecture.md](./crm/01-integrations-architecture.md) · [orchestrator-satellite-vs-module.md](./orchestrator-satellite-vs-module.md)

**Оговорка по «аудиту банка T-5».** Отдельного файла или строки `T-5` / `T5-` в `docs/` на 27.11.2026 не найдено. Ориентиры банковского кластера в этом ADR: `docs/adr/bank-satellite-gap-analysis.md` (§3 «топ-5 CBS»), `docs/BANK-AUDIT-2026-11-25-v3.md` и `v4.md`, матрицы Bank-DBO / Bank-CBS в `docs/acceptance/`.

---

## 1. Решение

1. Целевая карта — единый источник правды для витрины, админки оркестратора и бэклога контрактов. Каждое ребро имеет статус **есть** / **частично** / **долг**, независимо от того, реализовано ли оно сегодня.
2. На публичной схеме: **сплошная** линия только для статуса «есть»; **длинный штрих** — «частично»; **пунктир** с подписью «в разработке» (или эквивалент в az/en) — «долг». Узлы банковского кластера (Bank CBS, ДБО и клиентские каналы) несут статус **Pilot**.
3. Оркестратор на схеме — **платформа / основание**, к которому подключены оба ядра. На основании подписаны три платформенных сервиса: идентичность, биллинг, каталог. Это не третье «солнце» и не отраслевой сателлит.
4. CRM — **общий клиентский слой** (полоса / кольцо), а не звезда линий ко всем сателлитам. Workforce — **общий кадровый слой**. Data HUB — платформенный справочник / будущая аналитика, без вымышленных «уже живых» спиц.
5. Банковский кластер группируется вокруг Bank CBS: ДБО (`banking_dbo`, приложение `era-bank-dbo`) и клиентские каналы. Это модули / каналы ядра `industry_banking`, не отдельный ключ в `satellites`.
6. Рёбра витрины хранятся в БД (`SiteArchitectureEdge` или эквивалент) и правятся в оркестраторе. Сид идемпотентен и **не затирает** ручные строки. Поле статуса (`realizationStatus`: `live` | `partial` | `planned`) обязательно.

### Как классифицировали статус

| Статус | Критерий | Линия на схеме |
|---|---|---|
| **есть** | Есть контракт события и/или канал в allowlist **и** рабочий обработчик / fan-out / проводка (не stub) | сплошная |
| **частично** | Контракт, desired edge, endpoint или MVP есть, но нет S2S-гейта, проводка неполная, обработчик stub/ack-only, AC не закрыт | длинный штрих |
| **долг** | Цель из ADR/PRD или логичное отраслевое ребро без живого пути в коде | пунктир, подпись «в разработке» |

Доказательства сняты 27.11.2026 по коду и ADR в `D:\My Projects\era-ecosystem`. Придуманных «уже существующих» связей нет.

---

## 2. Полная таблица рёбер

Направление «→» — поток данных (кто публикует / инициирует). «↔» — двусторонний целевой контур (в колонке «Что передаётся» указаны оба направления). Ключи — `satellites.key`, кроме оркестратора (платформа) и ДБО (модуль `banking_dbo`).

### 2.1. Есть в коде

| # | Откуда | Куда | Что передаётся | Статус | Доказательство |
|---|---|---|---|---|---|
| 1 | `industry_hotel_pms` | `finance_core` | Счета, ночной аудит, бронь, city ledger, комиссия агентства (`SATELLITE_HOTEL_*`) | есть | `era-finance-core/.../satellite-event-dispatch.service.ts` — обработчики hotel; `desiredEdges` `REVENUE_EVENT`; контракты `packages/era-contracts` |
| 2 | `industry_fnb_pos` | `finance_core` | Продажа, смена, списание стока | есть | тот же dispatch (sale/shift/stock); канал `REVENUE_EVENT` |
| 3 | `industry_retail` | `finance_core` | Продажа, смена, движения склада ядра | есть | dispatch retail sale/shift + `InventoryService` |
| 4 | `industry_clinic` | `finance_core` | Визит, лаборатория, процедура, рецепт, койко-день | есть | dispatch clinic visit/lab/procedure/prescription/ward day |
| 5 | `industry_auto_service` | `finance_core` | Закрытый наряд (`SATELLITE_AUTO_WORK_ORDER_COMPLETED`) | есть | dispatch `handleAutoSto` / work order |
| 6 | `industry_logistics` | `finance_core` | Завершённый рейс (`SATELLITE_LOGISTICS_TRIP_COMPLETED`) | есть | dispatch logistics trip |
| 7 | `industry_wholesale` | `finance_core` | Подтверждённый заказ (`SATELLITE_WHOLESALE_ORDER_CONFIRMED`) | есть | dispatch wholesale order |
| 8 | `industry_construction` | `finance_core` | Акт выполнения (проводка WIP/AR), дополнительное соглашение; смета → SOV без авто-GL | есть | dispatch `handleConstructionAct` (~L1766), change request, estimate → `seedSovFromEstimatePackage`; ADR `construction-domain-boundaries.md`, `construction-satellite-gap-analysis.md`. Счёт из акта и НДС в PayApp — отдельно в долге (#D18) |
| 9 | `industry_crm` | `finance_core` | Конвертация лида, зафиксированный визит | есть | dispatch CRM lead convert + visit logged |
| 10 | `industry_banking` | `finance_core` | Суточный GL-summary банка → журнал NAS | есть | публикация `POST internal/v1/finance-bridge/summary` в `era-bank-core/.../finance-bridge.controller.ts`; потребление `handleBankGlDailySummary` (~L2356) |
| 11 | `platform_workforce` | `finance_core` | Табель (approve), найм/увольнение, отсутствия, оргструктура, позиции, clock-batch | есть | dispatch HR/timesheet; ADR `workforce-timesheet-construction-bridge.md` |
| 12 | `industry_fnb_pos` | `industry_hotel_pms` | Постование в фолио, расчёт (`FOLIO_POST`, `SETTLEMENT`) | есть | `satellite-channels.constants.ts` `CHANNEL_HOTEL_BRIDGE_FROM`; гейт в F&B |
| 13 | `industry_clinic` | `industry_hotel_pms` | То же: фолио и расчёт | есть | тот же allowlist |
| 14 | `industry_retail` | `industry_hotel_pms` | То же: фолио и расчёт | есть | тот же allowlist |
| 15 | `industry_hotel_pms` | `industry_clinic` | Жизненный цикл гостя (заезд/выезд, переезд, санаторная бронь, смена продукта) | есть | `clinic-lifecycle-event.ts`, `maybeEnqueueClinicFanout` → `POST {clinic}/api/integration/hotel-lifecycle` |
| 16 | `platform_workforce` | `industry_hotel_pms` | Провижининг / деактивация сотрудника (`STAFF_PROVISIONED` / `STAFF_DEACTIVATED`) | есть | `maybeEnqueueStaffFanout`; роли `packages/era-contracts/src/workforce/satellite-roles.ts`; `FANOUT_URL_ENV` |
| 17 | `platform_workforce` | `industry_fnb_pos` | То же | есть | тот же каталог ролей и fan-out |
| 18 | `platform_workforce` | `industry_retail` | То же | есть | тот же каталог ролей и fan-out |
| 19 | `platform_workforce` | `industry_clinic` | То же | есть | тот же каталог ролей и fan-out |
| 20 | `platform_workforce` | `industry_construction` | То же | есть | тот же каталог ролей и fan-out |
| 21 | `industry_construction` | `platform_workforce` | Импорт табеля в CP (`WORKFORCE_TIMESHEET_BATCH_IMPORTED`); CP — SoR посещаемости | есть | ADR `workforce-timesheet-construction-bridge.md`; событие construction → оркестратор → WorkforceTimesheet |
| 22 | любой подключённый продукт (оба ядра и сателлиты) | оркестратор | Идентичность, биллинг, каталог, шина событий, entitlements, launch URL | есть | `docs/adr/orchestrator-platform-integration-gateway.md`; Bank CBS в `INDUSTRY_SATELLITE_KEYS`; connect / billing / events. На схеме рисуется как основание, не как звезда спиц |

### 2.2. Частично

| # | Откуда | Куда | Что передаётся | Статус | Доказательство |
|---|---|---|---|---|---|
| 23 | `industry_wholesale` | `industry_retail` | Операционная передача заказа / остатка (`OPS_HANDOFF`) | частично | Желаемые рёбра PLATFORM в `satellite-channels.service.ts` (с 2026-11-05). `assertChannelEnabled` ждёт первый S2S-клиент; живого клиента нет. ADR channels: «desired edges landed, gate waits» |
| 24 | `industry_crm` | `industry_clinic` | Намерение записи на приём (`crm.clinic.appointment_intent`) | частично | `era-crm/.../clinic-lead-intent.ts` публикует best-effort. Это CRM → клиника, не захват пациента из клиники. Audit CRM W5 |
| 25 | `platform_workforce` | `industry_banking` | HR-провижининг сотрудника банка | частично | `era-bank-core/.../finance-bridge.controller.ts` `POST internal/v1/staff-provisioning` — «MVP stub — acknowledge only». Ключа банка нет в `FANOUT_URL_ENV` / каталоге ролей пяти сателлитов |
| 26 | `platform_datahub` | `finance_core` | Справочники (FX, календарь, банки, UoM, налог, валюты, ВЭД…) — ядро как потребитель | частично | `era-data-hub.md`: SoR в хабе, кэш в Finance (`DataHubClientService`). Wave 2 Platform Gateway ещё Planned (`orchestrator-platform-integration-gateway.md`) |
| 27 | `platform_datahub` | `industry_construction` | Номенклатура стройматериалов (код, UoM, HS, индикативная цена) | частично | ADR `data-hub-construction-materials.md` — MVP landed 2026-11-20, AC жёлтый (негативы + UAT) |
| 28 | `industry_banking` | ДБО / клиентские приложения (`banking_dbo`) | Счета, карты, платежи, кредитные заявки, 3DS, исламские продукты, open banking — каналы ДБО к headless CBS | частично | Контроллеры `era-bank-core/.../modules/dbo/*` с `@RequireBankingModule("banking_dbo")`; отдельное приложение `era-bank-dbo`. По `BANK-AUDIT-2026-11-25-v4` «живых интеграций нет»; leasing BFF в ДБО отсутствует. Статус узлов кластера на витрине — **Pilot** |

### 2.3. Долг (целевые и предложенные отраслевые связи)

Клиенты всех отраслевых сателлитов в целевой модели попадают в CRM; оплаты и юридически значимые проводки — в ERA Core. На 27.11.2026 **ни один** отраслевой сателлит не публикует контакт / гостя / пациента в CRM (поиск `SATELLITE_CRM_LEAD` / emit-to-CRM по hotel, clinic, construction, auto, fnb, retail — пуст). В CRM есть только *шаблоны* пайплайнов «Hotel — guest inquiry», «Clinic — patient inquiry» для входящих форм, это не ingest из сателлита.

| # | Откуда | Куда | Что передаётся | Статус | Основание / доказательство отсутствия |
|---|---|---|---|---|---|
| D1 | `industry_hotel_pms` | `industry_crm` | Гость / компания (party), бронь как контекст лида | долг | Шаблоны пайплайнов в `pipelines.service.ts`; публикации из отеля нет. MDM `globalPersonId` — идентичность, не CRM |
| D2 | `industry_clinic` | `industry_crm` | Пациент / направление | долг | Есть обратный путь CRM → клиника (#24). Ingest пациента из клиники нет |
| D3 | `industry_construction` | `industry_crm` | Заказчик, пресейл-лид, гарантийный кейс (ссылки `SelectionPackage`, `WarrantyCase`) | долг | `construction-domain-boundaries.md`, gap-analysis: CRM владеет pre-sale lead→convert; в `era-construction` emit в CRM не найден. Чингиз явно запросил это ребро |
| D4 | `industry_auto_service` | `industry_crm` | Клиент / владелец ТС | долг | Логичное партийное ребро; в коде нет |
| D5 | `industry_retail` | `industry_crm` | Покупатель / карта лояльности | долг | нет emit |
| D6 | `industry_wholesale` | `industry_crm` | Контрагент (покупатель опта) | долг | нет emit |
| D7 | `industry_logistics` | `industry_crm` | Грузоотправитель / грузополучатель | долг | нет emit |
| D8 | `industry_fnb_pos` | `industry_crm` | Гость / постоянный гость (часто через отель) | долг | нет прямого emit; допустимо идти через Hotel party |
| D9 | `industry_banking` | `industry_crm` (и MDM) | Клиент банка / KYC-party | долг | В gap-analysis банка — stub upgrade MDM trust; живого sync в CRM нет |
| D10 | `industry_wholesale` ↔ `industry_logistics` | — | Опт → логистика: заявка на отгрузку; логистика → опт: рейс, ТТН, POD, статус доставки | долг | В `CHANNEL_*` и fan-out пары нет (кроме желаемого OPS_HANDOFF опт→розница) |
| D11 | `industry_retail` ↔ `industry_logistics` | — | Розница → логистика: доставка в магазин / клиенту; обратно — POD и статус | долг | каналов нет |
| D12 | `industry_auto_service` | `industry_retail` | Передача / продажа запчастей в розничный контур | долг | каналов нет |
| D13 | `industry_retail` / склад ядра | `industry_auto_service` | Отпуск запчастей с склада в наряд | долг | Деньги наряда уже в #5; складская передача retail/core → STO не оформлена каналом |
| D14 | `industry_auto_service` | `industry_hotel_pms` | Начисление в фолио номера (услуги сервиса гостю отеля) | долг | Явно отложено в `satellite-integration-channels.md`, пока не появится room-charge. `CHANNEL_HOTEL_BRIDGE_FROM` автосервис не включает |
| D15 | `platform_workforce` | `industry_logistics`, `industry_auto_service`, `industry_wholesale`, `industry_crm` | Провижининг сотрудников в оставшиеся сателлиты | долг | Каталог ролей и `FANOUT_URL_ENV` — только пять ключей (#16–20). Банк — отдельно, частично (#25) |
| D16 | отраслевые сателлиты и оба ядра | `platform_datahub` | Аналитические факты / витрины (Gold BI и т. п.) | долг | Data HUB сегодня — Reference Data / DaaS (`era-data-hub.md`), не шина аналитики «со всех». Продуктовая цель — хаб как аналитический слой |
| D17 | `platform_datahub` | остальные сателлиты (hotel, fnb, retail, clinic, auto, logistics, wholesale, crm, banking) | Справочники через Platform Gateway (календарь, FX, VÖEN, UoM…) | долг | Gateway W2 Planned; legacy-потребление есть у Finance (#26) и частично у construction (#27) |
| D18 | `industry_construction` | `finance_core` | Счёт (invoice) из утверждённого акта; НДС в PayApp | долг | Gap-analysis: проводка акта есть (#8), «later invoice», НДС в PayApp отсутствует |
| D19 | `industry_clinic` | `platform_datahub` | Справочники (номенклатура исследований, ICD и т. п.). Лаборатория клиники остаётся модулем клиники, отдельного сателлита LIS нет | долг | Предложение слоёв; лаборатория уже даёт события в Finance (#4) внутри клиники |
| D20 | пары с видом `READ_STATUS` | — | Чтение статуса (наличие номера, слота, остатка) без записи | долг | Схема enum готова, PLATFORM-рядов нет (`satellite-integration-channels.md`) |

---

## 3. Как показывать на схеме (анти-каша)

- **Оркестратор** — горизонтальное основание под обоими ядрами: подписи «Идентичность · Биллинг · Каталог». Короткие вертикальные «ножки» от ERA Core и Bank CBS в основание. Не рисовать спицу от каждого сателлита в оркестратор.
- **CRM** — верхняя полоса «Клиентский слой». Короткие вертикальные засечки от отраслевых кластеров (не звезда через всё поле). Сплошная только у CRM → ERA Core (#9). Засечки сателлит → CRM — пунктир «в разработке».
- **Workforce** — кадровая полоса над основанием. Сплошные короткие линии к пяти сателлитам (#16–20) и к табелю строительства (#21). К банку — длинный штрих (#25). К остальным — пунктир, можно одной подписью «провижининг, в разработке».
- **Банковский кластер** — рамка вокруг Bank CBS + ДБО / клиентские приложения, бейдж Pilot. Ребро CBS → ERA Core (GL, #10) — сплошное. CBS ↔ ДБО — длинный штрих (#28). CBS → основание оркестратора — сплошное.
- **Шина выручки** — тонкий коллектор к ERA Core для рёбер #1–11, чтобы не вести десять длинных кривых через поле.
- **Гостеприимство** остаётся кластером (Hotel, F&B, Clinic); Construction **вне** этой рамки. Торговля: Wholesale, Retail, Logistics. Auto и Construction — полевые / сервисные узлы рядом, но не внутри отеля.
- Data HUB стоит на платформенном основании (Pilot). Живые/частичные связи — только к Finance и Construction; аналитические спицы — пунктир.

---

## 4. Бэклог долга: приоритеты и предлагаемые контракты

Контракты класть в `packages/era-contracts` (события + Zod-схемы, тот же стиль, что `SATELLITE_*`). Имена ниже — предложение; при реализации можно уточнить, не плодя синонимов.

### P0 — закрыть дыры, которые уже в ADR и в запросе на схему

| Приоритет | Рёбра | Предлагаемый контракт | Примечание |
|---|---|---|---|
| P0 | D3 Construction → CRM | `SATELLITE_CONSTRUCTION_CUSTOMER_UPSERTED`, `SATELLITE_CONSTRUCTION_WARRANTY_OPENED` | Заказчик / гарантия; лид pre-sale остаётся в CRM, стройка шлёт party + ссылки на проект / `WarrantyCase` |
| P0 | D1, D2 и каркас для D4–D9 | `SATELLITE_CRM_PARTY_UPSERTED` | Единый конверт: `sourceSatelliteKey`, `partyType` (`guest` \| `patient` \| `customer` \| `counterparty` \| `consignor` \| `bank_customer`), `globalPersonId?`, `displayName`, `contacts[]`, `context` (reservationId / visitId / projectId…). Первыми потребителями: Hotel, Clinic, Construction |
| P0 | #25 довести до «есть» | Расширить `STAFF_PROVISIONED` / каталог ролей на `industry_banking`; убрать stub в `staff-provisioning` | Банк уже имеет endpoint, нужна реальная привязка к ops-пользователю |

### P1 — добить начатые каналы и торговый контур

| Приоритет | Рёбра | Предлагаемый контракт | Примечание |
|---|---|---|---|
| P1 | #23 Wholesale → Retail | Существующий `OPS_HANDOFF` + S2S-клиент и `assertChannelEnabled` | Не новый тип события, а включение гейта |
| P1 | D10 Wholesale ↔ Logistics | `SATELLITE_WHOLESALE_DISPATCH_REQUESTED`, `SATELLITE_LOGISTICS_SHIPMENT_UPDATED` (status, POD, TTN) | |
| P1 | D11 Retail ↔ Logistics | `SATELLITE_RETAIL_REPLENISHMENT_REQUESTED`, тот же `SATELLITE_LOGISTICS_SHIPMENT_UPDATED` с `targetSatelliteKey` | |
| P1 | D18 счёт из акта | `SATELLITE_CONSTRUCTION_ACT_INVOICE_REQUESTED` или продолжение существующего progress-act с явным invoice-командным контрактом | Плюс НДС в PayApp (домен Finance, не обязательно новое SATELLITE_* ) |
| P1 | #26 / D17 | Platform Gateway Wave 2 (уже в ADR gateway) | Каталог хаба через оркестратор, без прямого legacy-kit в industry apps |

### P2 — остальные отраслевые и аналитика

| Приоритет | Рёбра | Предлагаемый контракт | Примечание |
|---|---|---|---|
| P2 | D12, D13 Auto ↔ Retail / склад | `SATELLITE_AUTO_PARTS_TRANSFER` (direction, sku, qty, warehouseId, workOrderId?) | |
| P2 | D14 Auto → Hotel folio | `SATELLITE_AUTO_FOLIO_CHARGE` | Только после появления room-charge, как сказано в channels ADR |
| P2 | D15 Workforce → остальные | Расширить `satellite-roles.ts` + `FANOUT_URL_ENV` | Тот же `STAFF_PROVISIONED`, новые ключи |
| P2 | D9 Bank → CRM / MDM | `SATELLITE_BANK_CUSTOMER_SYNCED` | После живого MDM trust (сейчас stub) |
| P2 | D16 аналитика в Data HUB | `SATELLITE_ANALYTICS_FACT_EMITTED` (source, factType, period, measures, dimensions) | Не подменять Reference Data; отдельный контур Gold |
| P2 | D19 Clinic → Data HUB refs | расширение registry Data HUB, не обязательно событие | Справочник, pull через Gateway |
| P2 | D20 `READ_STATUS` | использовать уже существующий enum, завести PLATFORM-ряды | Когда появится первый клиент (наличие номера / слота / остатка) |
| P2 | #28 ДБО | довести каналы ДБО и leasing BFF до живого контура; тогда статус ребра → «есть», Pilot можно снять отдельно | |

CRM → Finance (#9) уже есть и **не** подменяется party-sync: оплаты и конвертация лида остаются финансовым контуром.

---

## 5. Последствия

- Витрина может честно показывать целевую архитектуру: зритель видит и живые, и запланированные связи, не путая их.
- Бэклог контрактов привязан к конкретным рёбрам и файлам, а не к «надо бы интегрировать всё».
- Редактура схемы идёт через БД оркестратора, без пересборки фронта (см. обновлённый `docs/era-site-home-architecture-prompt.md`).
- Появление нового отраслевого сателлита: авто-ребро `REVENUE_EVENT` → `finance_core` (как в `desiredEdges`) и **planned**-ребро party-sync → CRM. Авто-звёзд в Workforce и Data HUB нет.

## 6. Сводка на 27.11.2026

| Статус | Количество рёбер в этой таблице |
|---|---|
| есть | **22** |
| частично | **6** |
| долг | **20** |
| **всего** | **48** |

Главный долг: party-sync всех отраслей в CRM (D1–D9, первыми Hotel / Clinic / Construction); довести HR банка и ДБО; включить OPS_HANDOFF опт→розница; логистика ↔ опт/розница; счёт из строительного акта; справочники и аналитика Data HUB.

