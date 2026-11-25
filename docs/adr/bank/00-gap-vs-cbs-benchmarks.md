# ERA Bank — Gap vs mid-tier CBS (§§0–7)

> Split from [bank-satellite-gap-analysis.md](../bank-satellite-gap-analysis.md).
> Status: living backlog (code HAS changed since the original 2026-11-25 01:01 snapshot). See also [BANK-AUDIT-2026-11-25.md](../BANK-AUDIT-2026-11-25.md).

## 0. Коротко (TL;DR)

1. **Ширина у нас огромная** (103 Prisma-модели, 21 L2-модуль: от депозитов и кредитов до деривативов, кастоди, исламского окна, пенсий, PSA). По ширине мы шире любого из пяти бенчмарков. **Глубина в ключевых для БОКТ и лизинга местах — тонкая.** Capability Inventory помечает почти всё как `IN`, но во многих строках это «lab scaffold», то есть поле в модели плюс эндпоинт.
2. **Лизинга как продукта нет.** `LOAN_LEASE` = обычный аннуитетный кредит с обязательной строкой `assetRef`. Нет реестра предметов лизинга, авансового платежа, выкупной/остаточной стоимости, страхования предмета, НДС-логики, изъятия, IFRS 16 у лизингодателя.
3. **БОКТ как типа организации нет вообще** (0 упоминаний `BOKT/NBCO` в коде и доках). Нет группового кредитования (только `groupId optional in paramsJson`), нет полевых офицеров, нет отдельного плана счетов/отчётности для БОКТ.
4. **Кредитное ядро не дотягивает до уровня Colvir / Fineract / Mambu:** нет ежедневного начисления процентов по кредитам в EOD, нет пени/штрафов, нет льготного периода, нет досрочного погашения с пересчётом графика, нет расчёта **фактической годовой процентной ставки (ФГПС)**, график только помесячный.
5. **Регуляторика АР — главный разрыв:** нет классификации активов и резервов по правилам ЦБА (6 категорий, 1–100%), а это обязательная параллель к МСФО 9. Нет выгрузки в Центральный кредитный реестр и в АКБ (кредитные бюро). Отчёт в СФМ (FMN) — XML-заглушка из 4 полей. Все рельсы (AZIPS/XÖHKS/AÖS/SWIFT), ASAN/SİMA, AzeriCard и AKB — stub. Open Banking не следует мануалу ЦБА (шлюз ЦБА, согласие ≤ 90 дней).
6. **Есть P0-дефект в денежном ядре:** проверка доступного остатка и списание идут на уровне изоляции READ COMMITTED (по умолчанию в Prisma), без блокировки строки. ADR D6 обещает Serializable/RR. Два параллельных дебета могут оба пройти проверку и увести счёт за лимит.
7. **Наши реальные преимущества** (проверены в коде): единый `globalPersonId` через MDM на всю экосистему; разделение «банковский GL ↔ корпоративная бухгалтерия банка в finance-core»; headless API + Swagger; мульти-тенантность с fail-closed фильтром; maker-checker и неизменяемый аудит в одной транзакции с проводкой; модульное лицензирование `banking_*`; локализация AZ/RU/EN; ADİF-тегирование депозитов.

---

## 1. Где что лежит

| Что | Путь |
|-----|------|
| Регулируемый движок (NestJS, `/api/v1`, Swagger `/api/v1/docs`) | `era-bank-core/apps/api/src` |
| Prisma-схема банка (103 модели, ~84 КБ) | `era-bank-core/packages/database/prisma/schema.prisma` |
| Ядро L1 (ledger, posting-engine, CIF, EOD, product-factory, rates, branch, audit) | `era-bank-core/apps/api/src/kernel/*` |
| Модули L2 (21 шт.) | `era-bank-core/apps/api/src/modules/{aml,atm,cards,cash,collections,dbo,deposits,fee,islamic,loans,markets,multi-entity,payments,pension,platform-extras,psa,regreporting,risk,trade,treasury,wealth}` |
| Интеграции (stub/live через `BANK_*_MODE`) | `era-bank-core/apps/api/src/integration/*`, `modules/payments/stub-rail.adapter.ts`, `modules/cards/gateway/mock-azericard.gateway.ts`, `modules/loans/bureau.adapter.ts` |
| Ops UI (операционисты, ~60 страниц) | `era-bank/app/*`, модалки `era-bank/src/components/ops/modals/*` |
| ДБО (клиенты физ/юр) | `era-bank-dbo/app/(customer)`, `(corporate)` |
| ADR банка | `docs/adr/era-bank-core.md` (+ 5 смежных ADR) |
| Scope SSOT | `docs/acceptance/Bank-Capability-Inventory.md` |
| Тесты движка | `era-bank-core/apps/api/__tests__/*.spec.ts` (31 файл) |

**Этот файл:** `docs/adr/bank-satellite-gap-analysis.md` (рядом с `era-bank-core.md`).

---

## 2. Что у нас есть: зрелость по доменам (сверено с кодом)

| Домен | Inventory говорит | Что реально в коде | Оценка |
|-------|-------------------|--------------------|--------|
| GL / план счетов ЦБА / двойная запись | IN | `GlAccount`, `JournalTransaction/Entry`, `SystemGlConfig`, GL продуктов из `ProductTemplate.paramsJson`. Σ Дт = Σ Кт валидируется | ✅ |
| Posting engine, SoD, сторно, идемпотентность | IN | `kernel/posting-engine/*`, maker≠checker, `idempotency.ts`, 423 во время EOD | ✅ (но см. P0-1 про изоляцию) |
| CIF / KYC | PARTIAL | `BankCustomer`: `riskRating` (3 уровня), `pepFlag`, `kycStatus`, `kycTrustTier`, `sourceOfFunds`, `BeneficialOwner`. MDM при `MDM_REQUIRED=false` отдаёт `stub-person-*` | 🟡 |
| Счета, IBAN, холды/аресты, овердрафт | IN | `Account`, `AccountHold` (CARD_AUTH/LEGAL_ARREST/MANUAL/PAYMENT_PENDING) | ✅ |
| Product Factory | IN | `product-params.ts` (15 КБ): типизированные параметры по `ProductKind`, полосы, day-count, FLOATING index+spread, pricing exception с SoD | ✅/🟡 (UI авторинга частично, см. OPEN-TASKS) |
| Депозиты | IN | ACT/365 ежедневное начисление в EOD, капитализация, rollover, досрочное закрытие, ADİF-тег, call/structured | ✅ |
| Кредиты: выдача/график/погашение | IN | `loan-schedule.util.ts`: только **аннуитет и дифференцированный, только помесячно**; `loan-repay.util.ts`: водопад «проценты → тело» по графику | 🟡 |
| Начисление процентов по кредитам | (не выделено) | В EOD **нет** (в `loans.service.ts` 0 упоминаний accrual). Проценты = плановые из графика | 🔴 |
| Пеня / штрафы / льготный период / досрочное погашение | (не выделено) | 0 совпадений `penalt`, `grace`, `prepay/earlyRepay` | 🔴 |
| ФГПС (фактическая годовая ставка) | — | Нет (`resolveEffectiveRate` = floating index+spread, не APR) | 🔴 |
| Лизинг | IN («assetRef required») | Только `ProductKind.LOAN_LEASE` + обязательная строка `assetRef` + `paramsJson.assetRefTemplate` | 🔴 (scaffold) |
| Микрофинанс / групповые кредиты | IN | `LOAN_MFI` + «groupId optional in paramsJson». Модели группы нет | 🔴 |
| Факторинг | IN | `LOAN_FACTORING` + `invoiceRef` | 🟡 |
| Кредитные линии / синдикация | IN | `CreditLine`, `CreditLineDrawdown`, `participationPct`, `leadBankName` | 🟡 |
| Заявки / скоринг / политика | IN | `LoanApplication`, `CreditPolicyRule`, `CreditDecisionRequest`; AKB — stub (хеш от customerId → 550…800) | 🟡 |
| Залоги | IN | `collateralRef` — JSON-строка на кредите + `CollateralValuation`, `LienRegister`. Нет связи с реестрами (ƏMDK — 0 упоминаний в коде) | 🟡 |
| Collections / реструктуризация | IN | `CollectionCase`, `PromiseToPay`, write-off, forbearance stages | 🟡 |
| МСФО 9 ECL | DECLARED (lab) | `ecl.engine.ts`: STAGE_FLAT 1%/10%/50% или PD×LGD по матрицам; стадия только по DPD (30/90). Нет lifetime PD, макро-сценариев, дисконтирования, SICR кроме DPD. **Залог вычитается из EAD и ещё раз снижает LGD (двойной учёт)**. Проводка резервов с maker-checker — есть | 🟡 |
| Резервы по правилам ЦБА (классификация активов) | — | Нет (0 совпадений категорий) | 🔴 |
| Платежи внутренние / постоянные поручения / DD / виртуальные счета / чеки | IN | Есть, с проводками | ✅/🟡 |
| AZIPS / XÖHKS / AÖS / SWIFT | DECLARED | `StubRailAdapter`: `pacs.008 stub`, `simulatedAck: true`; live-режим бросает ConfigError | 🔴 |
| Карты (эмиссия/эквайринг/3DS/диспуты/ATM) | IN | Модели и переходы есть; шлюз `MockAzeriCardGateway` | 🟡 (mock) |
| AML правила | IN | 5 правил (порог, velocity 24h, structuring, high-risk, cross-border), кейсы, алерты | 🟡 |
| Санкционный скрининг | IN / BLOCKED feed | `sanctions-seed.json` — 4 демо-записи | 🔴 |
| FMN (СФМ) отчёт | IN | XML из 4 полей (`institutionMfo`, `reportType`, `periodFrom/To`), `schemaVersion: FMN-TEST-1` | 🔴 |
| Отчётность ЦБА | DECLARED | `CBAR_TRIAL_BALANCE`, `CBAR_BALANCE_SHEET_STUB`, `CBAR_LCR_STUB`, `CBAR_CAR_STUB`; live-сабмит → ConfigError | 🔴/🟡 |
| Капитал / LCR / NSFR / RWA / IRRBB / крупные риски | IN (lab) | Расчёты есть, не сертифицированы | 🟡 |
| FATCA/CRS | IN | Классификация + отчёт | 🟡 |
| ДБО физ/юр, двойная подпись, H2H, PFM | IN (lab) | Страницы и контроллеры есть; ASAN/SİMA — stub; заявка на кредит онлайн есть | 🟡 |
| Open Banking AIS/PIS | PARTIAL (lab) | Consent ≤90d enforced; свои Open API ключи; **нет** шлюза ЦБА / Manual v1.3 / TPP — Inventory `CAP-DBO-OB` PARTIAL | 🟡 |
| Мульти-организация / агентская модель | IN (lab) | `multi-entity.service.ts` 1,1 КБ, флаг `BANK_MULTI_ENTITY=1` | 🔴 (scaffold) |
| Пенсии / PSA / MIS / BPM / DMS | IN (lab) | сервисы по 0,8–2,7 КБ, «metadata stub» | 🔴 (scaffold) |
| Казначейство / рынки / кастоди / металлы | IN (lab) | Модели + базовые проводки | 🟡 |
| Мультитенантность | 🟡 | `organizationId` везде + fail-closed фильтр; SHARED-пул не построен | 🟡 |

### 2.1 Где документация расходится с кодом

| Утверждение в доках | Факт в коде | Что сделать |
|---------------------|-------------|-------------|
| ADR D6: «каждая денежная проводка — одна транзакция Serializable / repeatable-read» | `prisma.$transaction(...)` без `isolationLevel`; в `posting-engine.service.ts` сначала aggregate холдов и сравнение с остатком, потом `increment` — без `SELECT … FOR UPDATE` | P0-1 |
| Inventory `CAP-LN-LEASE = IN` | Только строка `assetRef` | Понизить до PARTIAL/DECLARED, пока не будет P1-лизинга |
| Inventory `CAP-LN-MFI = IN` («group lending») | Группы нет | Понизить до PARTIAL |
| Inventory `CAP-AML-SCR = IN` | 4 демо-имени в seed | Пометить «screening engine IN, list feed BLOCKED» явно в одной строке |
| Inventory `CAP-AML-RULE = IN … FMN export` | FMN XML — 4 поля, тестовая схема | Понизить FMN до DECLARED |
| Inventory `CAP-CORE-MENT / AGENCY / NFR-MIS / BPM / DMS = IN` | Сервисы 1–3 КБ | Ввести статус `SCAFFOLD`, чтобы не путать с IN |
| TZ §11: «sanction lists from data-hub shelf C» | Чтение из локального JSON | Связать с data-hub или убрать из TZ |
| TZ §12.4 / risk ADR: «Stage 1 = 12m ECL; Stage 2/3 = lifetime» | Одна ставка PD на стадию, без горизонта | P1-6 |

> Само Inventory честно предупреждает: «Product-Readiness ✅ ≠ full commercial bank», и запрещает фразы «GA», «certified IFRS 9». Но статус `IN` у scaffold-строк вводит в заблуждение при продаже. Рекомендую ввести 5-й статус **`SCAFFOLD`**.

---

## 3. Выбор топ-5 систем среднего уровня (и почему именно они)

Критерии: (1) не гиганты уровня Temenos Transact, Finastra, Oracle FLEXCUBE; (2) подходят малым/средним банкам, **БОКТ и лизингу**; (3) присутствие в СНГ/Кавказе/Азербайджане или эталон для облачного/открытого подхода; (4) по ним есть публичные данные.

| # | Система | Почему в списке | Присутствие в АР / регионе |
|---|---------|-----------------|----------------------------|
| 1 | **R-Style Softlab RS-Bank V.6** | Самая распространённая АБС среднего уровня в банках Азербайджана; модульная (RS-Core, RS-Banking, RS-Loans, RS-Retail, RS-Dealing, RS-Reporting); МСФО 9 реализован с 2018 | Bank of Baku (апгрейд до V.6), Bank Respublika (с 1993), Xalq Bank, United Credit Bank, Standard Bank |
| 2 | **Colvir CBS** (+ Colvir Microfinance Core) | Лидер в Казахстане и Туркменистане, локализован под АР; 100+ модулей, product factory, BPM, сервисная шина, **отдельные модули Лизинг и Факторинг**, отдельная коробка для МФО | Ziraat Bank Azerbaijan, Azərpoçt; выступал на ABA (Ассоциация банков АР) |
| 3 | **Mambu** | Эталон облачного composable-ядра (SaaS) для кредиторов, BNPL, ипотеки, исламского банкинга; API-first, configuration-as-code, вебхуки и стриминг | Европа, Азия, Африка; в АР внедрений не нашли — берём как эталон архитектуры и продукта |
| 4 | **Apache Fineract / Mifos X** | Open-source (Apache 2.0) ядро для МФО/БОКТ: индивидуальные, **групповые и JLG-кредиты**, сбережения, начисления (charges), залоги, учёт по начислению, отчёты | Сотни МФО в мире; хороший эталон модели данных для БОКТ |
| 5 | **Oradian** | Облачное ядро специально под МФО и малые банки развивающихся рынков: групповое и солидарное кредитование, офлайн-работа полевых офицеров, регуляторные отчёты | Нигерия (LARDI ~360 тыс. клиентов), Филиппины (RAFI 300 тыс.+); эталон для БОКТ-сегмента |

**Рассмотрены и не взяты:** ЦФТ-Банк (сильная система, но в АР был только VTB-Azerbaijan; по функционалу близка к RS-Bank, а для 2026 г. есть санкционные/поддержечные риски у российских вендоров [U]). Diasoft FA# (аналогично; публичных внедрений в АР не нашли). Thought Machine Vault (по масштабу и цене ближе к тир-1). Bifit / Vision / Sopra / Nymbus / Craft Silicon (мало данных по региону). Instafin = прежнее имя продукта Oradian.

> Отдельно для **лизинговых компаний** (не банков) рынок обычно использует специализированные решения (NetSol Transcend, Alfa Systems, 1С:Лизинг) [U]. Их функции лизинга перечислены ниже в разрывах как эталон.

---

## 4. Матрица сравнения функциональности

Легенда: ✅ сильная сторона · 🟡 есть, базово · ❌ нет / вне продукта · [U] по публичным данным не подтверждено.

| Возможность | **ERA Bank** (код) | RS-Bank V.6 | Colvir CBS | Mambu | Fineract / Mifos X | Oradian |
|-------------|--------------------|-------------|------------|-------|--------------------|---------|
| Product factory без кода | ✅ параметры, полосы, FLOATING; 🟡 UI | ✅ справочники и настройки | ✅ product factory + конструктор шаблонов + BPM | ✅ configuration-as-code, custom fields | ✅ шаблоны продуктов | ✅ |
| Кредиты: графики | 🟡 аннуитет/дифф., помесячно | ✅ | ✅ balloon, grace, разные методы аннуитета, несколько ставок | ✅ гибкие графики, interest-only, offset | ✅ много типов графиков, grace, перенос по праздникам | ✅ |
| Начисление % по кредитам (accrual) | ❌ | ✅ | ✅ | ✅ accrual или cash по продукту | ✅ | ✅ |
| Пени, штрафы, комиссии по событию | 🟡 тарифы комиссий есть; пени ❌ | ✅ неустойки | ✅ начисление пени | ✅ | ✅ charges/penalties | ✅ |
| Досрочное погашение и пересчёт графика | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Реструктуризация | 🟡 стадии forbearance | ✅ | ✅ | ✅ | ✅ reschedule | ✅ |
| **Лизинг** | ❌ (только `assetRef`) | [U] отдельного модуля в коробке нет | ✅ модуль «Лизинг» + IFRS 16 | 🟡 через кредитные продукты [U] | ❌ | ❌ |
| Факторинг | 🟡 | 🟡 уступки | ✅ модуль «Факторинг» | 🟡 | ❌ | ❌ |
| Групповые / JLG кредиты (МФО) | ❌ | ❌ | ✅ Microfinance Core | 🟡 | ✅ group + JLG | ✅ group/solidarity |
| Депозиты | ✅ | ✅ | ✅ | ✅ | ✅ savings/FD/RD | ✅ |
| GL / бухучёт | ✅ банковский GL + отдельная бухгалтерия в finance-core | ✅ «Главная книга» | ✅ | ✅ subledger + GL-правила | ✅ | ✅ |
| МСФО 9 ECL | 🟡 lab | ✅ ЭПС, АС, резервы | ✅ | 🟡 через партнёров/данные [U] | 🟡 [U] | 🟡 [U] |
| Резервы по национальному регулятору | ❌ (ЦБА) | ✅ (ЦБ РФ; АР — локализация [U]) | ✅ локализация под АР | ❌ (делает клиент) | ❌ | 🟡 локальные отчёты |
| Залоги и реестр | 🟡 | ✅ | ✅ collateral management | ✅ collateral tracking | ✅ | 🟡 |
| Collections | 🟡 | 🟡 | ✅ | ✅ arrears → collections | 🟡 | ✅ автоматизация до взыскания |
| KYC / AML | 🟡 правила + кейсы; списки — демо | 🟡 | ✅ | 🟡 через партнёров | 🟡 | 🟡 |
| Платёжные системы страны | ❌ stub | ✅ (в РФ — УФЭБС/SWIFT; в АР — AZIPS [U]) | ✅ внутренняя платёжная система + интеграции | 🟡 payments orchestration | ❌ | ❌ |
| Карты | 🟡 mock-шлюз | ✅ | ✅ Payment Cards | 🟡 link to cards | ❌ | ❌ |
| Open API | ✅ REST + Swagger, headless | 🟡 RS-Connect | ✅ Service Bus + API | ✅ REST + streaming + webhooks | ✅ REST | ✅ API |
| Цифровые каналы (ДБО) | 🟡 lab | ✅ | ✅ | ❌ (партнёры) | 🟡 мобильное приложение Mifos | 🟡 мобильное приложение полевого офицера |
| Регуляторная отчётность | 🟡 4 шаблона-заглушки | ✅ RS-Reporting | ✅ хранилище данных + конструктор отчётов | ❌ (BI/экспорт) | 🟡 отчёты | ✅ «regulatory reporting» |
| Мульти-организация | 🟡 scaffold | ✅ | ✅ | ✅ multi-tenant SaaS | ✅ мульти-тенантность | ✅ SaaS |
| Развёртывание | SHARED / DEDICATED / ONPREM (по ADR); on-prem реально | On-prem (Oracle/MS SQL) | On-prem / частное облако | Только SaaS (AWS/GCP) | On-prem / облако, open source | SaaS |
| Цена | своя | лицензия + внедрение (закрыто) | лицензия + внедрение (закрыто) | подписка; на AWS Marketplace доп. счета по $0,01 в год за счёт | бесплатно (Apache 2.0), платят за внедрение | подписка (закрыто) [U] |
| Сквозная идентичность клиента с другими бизнесами | ✅ `globalPersonId` (банк + отель + клиника + HR) | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 5. Что есть у них, но нет у нас

1. **Полноценный жизненный цикл кредита:** ежедневное начисление процентов, пени, льготный период, кредитные каникулы, досрочное (частичное/полное) погашение с выбором «уменьшить срок / платёж», перенос дат по выходным, balloon, несколько ставок на одном договоре (Colvir, Fineract, Mambu).
2. **Лизинг как отдельный модуль** (Colvir): договор, предмет лизинга, график лизинговых платежей, аванс, выкуп, остаточная стоимость, страхование, учёт по МСФО 16, резервы.
3. **Микрофинансовая модель** (Fineract, Oradian, Colvir MF Core): группы, JLG, солидарная ответственность, центры/встречи, полевой офицер и офлайн-сбор платежей.
4. **Национальная локализация «из коробки»:** резервы по правилам регулятора, регуляторные формы, обмен с кредитным реестром (RS-Bank, Colvir).
5. **Конструктор отчётов и хранилище данных для регуляторики** (Colvir DWH + конструктор, RS-Reporting). У нас MIS/BPM/DMS — заглушки.
6. **BPM-конструктор процессов** (Colvir) и **вебхуки/стриминг событий для клиентов-интеграторов** (Mambu). У нас события идут только во внутренний orchestrator.
7. **Configuration-as-code с версионированием продуктов и сред** (Mambu).
8. **Боевые интеграции** с платёжными системами, процессингом карт, бюро и госсервисами. У нас всё в stub.

## 6. Что есть у нас, но нет у них (только проверенное в коде)

1. **Единый `globalPersonId` через MDM orchestrator.** Один человек = клиент банка, гость отеля, пациент клиники, сотрудник. Ни у одного из пяти такого нет (ADR D4, `BankCustomer.globalPersonId`).
2. **Чёткое разделение двух бухгалтерий:** банковский GL в `banking-core` и корпоративная бухгалтерия банка (ОС, зарплата, НДС, закупки) в `era-finance-core` (ADR D1/D7). У RS-Bank и Colvir это одна система или отдельные продукты.
3. **Headless из коробки:** весь движок за REST `/api/v1` + Swagger, ops UI и ДБО — отдельные приложения. Ближе к Mambu, чем к RS-Bank/Colvir.
4. **Модульное лицензирование `industry_banking` + `banking_*` + квота активных филиалов** через общий биллинг экосистемы.
5. **Maker-checker + неизменяемый аудит в одной ACID-транзакции с проводкой**, блокировка постинга во время EOD (423), идемпотентность.
6. **Локализация AZ/RU/EN** и азербайджанские сущности в модели: ADİF-тег, VÖEN, МФР между филиалами, AZIPS/XÖHKS/AÖS в enum'ах рельсов.
7. **Ширина:** исламское окно, торговое финансирование (LC/BG/DC/SCF + MT7xx outbox), кастоди, банкострахование, pension/PSA — пусть и lab. Ни Fineract, ни Oradian этого не покрывают.
8. **Современный стек** (TypeScript/NestJS/Prisma/Postgres/Next.js), а не Oracle-монолит. Дешевле в on-prem и проще для собственной команды.

## 7. Наши слабые места (по приоритету риска)

1. **Корректность денег под нагрузкой** (P0-1): гонка в проверке доступного остатка.
2. **Кредитная математика:** нет начислений, пени, досрочки, ФГПС; `setMonth` на 29–31 числа «перескакивает» месяц; график строится от `new Date()`, а не от даты выдачи и с учётом рабочих дней.
3. **Регуляторная отчётность ЦБА и СФМ — заглушки**, а без них ни банк, ни БОКТ не запустятся.
4. **Резервы по ЦБА отсутствуют**, а ECL — lab с методологической ошибкой (двойной учёт залога).
5. **Нет лизинга и МФО-модели** — то есть 2 из 3 целевых сегментов не покрыты по сути.
6. **Тип организации не различается:** банк, БОКТ и лизинговая компания имеют разные лицензии, нормативы и отчёты. Модуль `industry_banking` пока «только банк».
7. **Все внешние интеграции stub** (рельсы, карты, ASAN/SİMA, AKB, ЦКР, санкционные списки, ƏMDK).
8. **Open Banking не по стандарту ЦБА.**
9. **Inventory завышает статусы** (scaffold помечен как IN) — коммерческий риск при демо и тендерах.

---
