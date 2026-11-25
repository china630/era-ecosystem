# ERA Bank — Gap-анализ банковского сателлита против топ-5 CBS среднего уровня + требования законодательства АР

**Дата:** 25.11.2026 · **Автор:** Мика (исследование для Cursor) · **Статус:** living backlog — original snapshot 2026-11-25 01:01; code HAS changed since (see BANK-AUDIT-2026-11-25.md)
**Область:** `era-bank-core` (регулируемый движок, NestJS + Prisma) · `era-bank` (ops UI, Next.js) · `era-bank-dbo` (ДБО, Next.js)
**Целевые клиенты (по запросу владельца):** банки малого/среднего размера, **БОКТ (bank olmayan kredit təşkilatları)**, **лизинговые компании**.
**Канон, с которым сверялись:** `docs/adr/era-bank-core.md`, `era-bank-risk-and-audit.md`, `era-bank-gl-account-mapping.md`, `era-bank-product-params.md`, `bank-domain-permissions-and-rbac.md`, `bank-multi-entity-holding.md`, `docs/acceptance/Bank-Capability-Inventory.md`, `Bank-Full-CBS-Roadmap.md`, `era-bank-core/PRD.md`, `era-bank-core/TZ.md`, `era-bank-core/doc/OPEN-TASKS.md`, `SECURITY-CHECKLIST.md`.

Обозначения: ✅ сделано в коде · 🟡 частично / lab · 🔴 нет или заглушка · **[U]** не проверено по первоисточнику, нужна проверка юристом.

---

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

## 8. Требования законодательства Азербайджанской Республики и наш статус

| # | Норма / регулятор | Что требует (кратко) | Наш статус | Источник |
|---|-------------------|----------------------|-----------|----------|
| L1 | Закон «О банках» (Banklar haqqında, № 590-IIQ, 2004) | Лицензирование, пруденциальные нормативы, банковская тайна, отчётность в ЦБА, внутренний контроль | 🟡 аудит/SoD есть; формы ЦБА — заглушки | e-qanun.az; cbar.az → Legislation |
| L2 | Закон «О небанковских кредитных организациях» (Bank olmayan kredit təşkilatları haqqında, № 933-IIIQ) | Лицензия ЦБА на кредитование; БОКТ после лицензии **может вести лизинг** (отдельная лицензия — только если её требует закон); свои нормативы и отчётность | 🔴 типа «БОКТ» нет | https://e-qanun.az/framework/19197 · https://www.cbar.az/law-2/the-law-of-the-republic-of-azerbaijan-on-non-bank-credit-institutions |
| L3 | Правила ЦБА «Aktivlərin təsnifləşdirilməsi və mümkün zərərlərin ödənilməsi üçün xüsusi ehtiyatların yaradılması» (решения 1851100014; 29/1-1) | 6 категорий: qənaətbəxş 1–2%, nəzarət altında 2–10%, əlavə risklərə məruz standart 10–20%, qeyri-qənaətbəxş 25%, təhlükəli 50%, ümidsiz 100%; берётся худшая из категорий по просрочке и качеству; ümidsiz списывается за счёт резерва | 🔴 нет | https://www.cbar.az/law-30/decision-no-1851100014 · https://e-qanun.az/framework/50081 · https://e-qanun.az/framework/40823 |
| L4 | МСФО (для банков обязательны; ЦБА требует МСФО 9) | ECL по стадиям, 12m / lifetime, прогнозная информация | 🟡 lab | TZ §12.4; закон «О бухгалтерском учёте» [U] |
| L5 | Закон о борьбе с легализацией и финансированием терроризма (2022) + решение СФМ от 27.04.2023 | Отчёт в СФМ (Maliyyə Monitorinqi Xidməti) о наличных операциях **от 20 000 AZN** (или эквивалент) в течение 3 рабочих дней; подозрительные операции — без порога; CDD/EDD, PEP, бенефициары, санкционные списки | 🟡 правила есть, но порог по умолчанию 15 000 AZN и «любой дебет», а не «наличные ≥ 20 000»; FMN-файл — заглушка; списки — демо | https://uploads.cbar.az/assets/e16bcadfeeeeb15950195dd9f.pdf · https://president.az/az/articles/view/58762 · номер закона [U] |
| L6 | Закон «О кредитных бюро» (№ 384-VQ) | Кредитные организации (банки и БОКТ) обязаны передавать кредитную историю минимум в одно действующее бюро; изменения статуса долга — в течение 30 дней, электронно | 🔴 только «pull score» stub, выгрузки нет | https://www.cbar.az/law-200/law-no-384-vq · https://acb.az/legislation |
| L7 | Централизованный кредитный реестр ЦБА (Mərkəzi Kredit Reyestri) | Банки передают данные о заёмщиках в реестр ЦБА | 🔴 | legalacts.az (новость 9033) [U по формату] |
| L8 | Закон «О платёжных услугах и платёжных системах» (2021–2023, номер [U]) | Участие в AZIPS (RTGS), XÖHKS (клиринг малых платежей), AÖS (мгновенные, 24/7, < 10 сек, ISO 20022, расчёт через AZIPS) | 🔴 stub | https://www.cbar.az/page-479/instant-payments-system-ips · https://uploads.cbar.az/assets/ea726cd499b78e06fc32db751.pdf |
| L9 | Open Banking ЦБА (Open Banking Manual v1.3, 27.03.2025; требования к сетевым каналам) | Все вызовы через **API-шлюз ЦБА**; x-Api-Key + JWT; согласие с усиленной аутентификацией **не дольше 90 дней**; AIS (список счетов, детали, баланс, выписка), PIS | 🟡 своя схема ключей; лимит 90 дней не проверяется | https://uploads.cbar.az/assets/1bfa75c99bbb602c84e5cbbd8.pdf · https://uploads.cbar.az/assets/065690085c3fa24081c3e4fa7.pdf · https://www.cbar.az/press-release-4941/statement-on-approved-requirements-for-open-banking?language=en |
| L10 | Закон «О персональных данных» (№ 998-IIIQ, 2010) + требования ЦБА по информационной безопасности поднадзорных | Общий закон не требует хранить все данные в АР, но **ЦБА требует хранить «чувствительную информацию» (ПДн, банковская тайна) только в АР при использовании облака**, сквозное шифрование, запрет субподряда, непрерывность | 🟡 on-prem возможен; SHARED-облако нужно проектировать с локализацией | https://uploads.cbar.az/assets/Information%20security%20requirements%20for%20supervised%20entities%20in%20financial%20markets%20.pdf |
| L11 | Закон «Об электронной подписи и электронном документе» + ASAN İmza / SİMA | Юридически значимая подпись, идентификация клиента | 🔴 stub (`asan-sima-stub.adapter.ts`); в finance-core есть боевой контур `AsanSimaGovSignatureAdapter` — переиспользовать | ADR `asan-sima-gov-signature.md`; номер закона [U] |
| L12 | Страхование вкладов (ADİF, закон «О страховании вкладов») | Тегирование застрахованных вкладов, реестр вкладчиков, взносы | 🟡 тег и снимок в EOD; реестра и взносов нет; лимиты покрытия [U] | adif.az [U] |
| L13 | Налоговый кодекс: проценты по вкладам физлиц | Ст. 102.1.22-4: сейчас освобождено до 200 AZN/мес процентов по манатным вкладам в одном банке и полностью при сроке ≥ 18 мес. По новостям от 16.11.2026 льгота на часть до 200 AZN **заканчивается с 2027 г.** → банк как налоговый агент удерживает налог у источника | 🔴 расчёта налога у источника нет | https://stabil.az/en/news/bank-deposits-to-be-taxed-from-next-year (окончательную редакцию проверить на taxes.gov.az [U]) |
| L14 | Налоговый кодекс: НДС и лизинг | Проценты по финансовому лизингу освобождены от НДС как финансовая услуга; с 25.12.2026 в НК обновлены формулировки «financial lease» [U] | 🔴 лизинговой НДС-логики нет | https://economy.gov.az/en/post/1805/... · https://taxsummaries.pwc.com/azerbaijan/corporate/other-taxes |
| L15 | Гражданский кодекс (глава о лизинге) | Договор финансового лизинга: стороны, предмет, продавец, риски, выкуп | 🔴 | e-qanun.az [U номер статей] |
| L16 | Требования ЦБА к раскрытию условий потребкредита (ФГПС) | Раскрывать фактическую годовую процентную ставку с учётом всех платежей [U точное наименование акта] | 🔴 | cbar.az [U] |
| L17 | Удалённая идентификация (ЦБА) | Правила удалённой идентификации клиентов [U] | 🔴 (нет liveness/видео) | cbar.az [U] |
| L18 | e-taxes / e-qaimə | Корпоративный налоговый учёт банка | ✅ в `era-finance-core` (ADR `etaxes-hsm-asan-submission.md`, `eqaime-s2s-submission.md`) | — |

---

## 9. Рекомендации для Cursor (P0 / P1 / P2)

Оценка трудоёмкости: S ≤ 3 дня · M 1–2 недели · L 3–6 недель · XL > 6 недель (1 разработчик). Все изменения денег — **только через `kernel/posting-engine`** (ADR D6). Каждая задача обновляет строку в `Bank-Capability-Inventory.md` в том же PR.

### P0 — блокеры продаж и корректности

**P0-1. Изоляция и блокировки в posting engine** · S
- Файлы: `era-bank-core/apps/api/src/kernel/posting-engine/posting-engine.service.ts` (проверка доступного остатка и `applyBalanceUpdates`), `teller-posting.service.ts`, прямые `ledgerBalanceMinor: { decrement/increment }` в `modules/treasury/treasury.service.ts` (3 места, в обход posting engine — проверить).
- Что сделать: `prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })` с retry на `P2034`, **или** `SELECT … FOR UPDATE` по счетам (отсортировать id, чтобы не было дедлоков), плюс условный update `WHERE available >= debit`. Пересчитывать `availableBalanceMinor` с учётом холдов в одном месте.
- AC: новый тест `posting-concurrency.spec.ts`: 50 параллельных дебетов по 10 AZN на счёт с остатком 100 AZN → ровно 10 успешных, остаток 0, Σ Дт = Σ Кт. ADR D6 совпадает с кодом.

**P0-2. Тип регулируемой организации: BANK / BOKT / LEASING** · M
- Модель: `enum InstitutionType { BANK BOKT LEASING_COMPANY CREDIT_UNION }` в `schema.prisma` (на уровне org-конфига `bank-org.config.ts` / runtime-config).
- Влияние: набор разрешённых `ProductKind` (БОКТ — без депозитов физлиц), набор отчётов (`regreporting`), план счетов (seed по типу), пруденциальные нормативы, модули в каталоге (`banking_bundle_nbco`, `banking_bundle_leasing`).
- AC: создание БОКТ-организации → в Product Factory нельзя активировать `TERM_DEPOSIT`; `/reports/cbar` показывает шаблоны БОКТ; seed плана счетов соответствует типу.

**P0-3. Классификация активов и резервы по правилам ЦБА (параллельно с МСФО 9)** · L
- Новые модели: `PrudentialClassificationRun`, `PrudentialClassificationResult { loanId, category (QENAETBEXS | NEZARET | ELAVE_RISK | QEYRI_QENAETBEXS | TEHLUKELI | UMIDSIZ), dpd, qualityFlags, rate, provisionMinor }`, `PrudentialRateTable` (параметры 1–2 / 2–10 / 10–20 / 25 / 50 / 100 % — как данные, не константы).
- Сервис: `modules/risk/prudential-provisioning.service.ts`; шаг в EOM рядом с `runEclBatch`; проводки через posting engine на отдельные GL резервов ЦБА (`SystemGlKey.PRUDENTIAL_ALLOWANCE/EXPENSE`); списание `ümidsiz` за счёт резерва с maker-checker.
- UI: `era-bank/app/risk/prudential/page.tsx` + колонка «Категория ЦБА» в `/loans`.
- AC: кредит с DPD 0/35/95/200/400 получает ожидаемые категории; берётся худшая из «просрочка» и «качество»; резерв проводится, сумма = Σ(остаток × ставка); отчёт сверяется с GL. Тест `prudential-classification.spec.ts`.

**P0-4. Кредитный движок: начисления, пени, грейс, досрочка, ФГПС** · L
- Файлы: `modules/loans/loan-schedule.util.ts`, `loan-repay.util.ts`, `loans.service.ts`, `kernel/eod/eod.service.ts`, `kernel/product-factory/product-params.ts`.
- Добавить в `LoanContract`: `accruedInterestMinor`, `accruedPenaltyMinor`, `lastAccrualDate`, `gracePrincipalMonths`, `graceInterestMonths`, `penaltyRateAnnual` (или `penaltyRule` в paramsJson), `repaymentFrequency` (MONTHLY/QUARTERLY/BULLET), `firstDueDate`, `aprPercent`.
- EOD: `loans.accrueDailyInterest(businessDate)` и `loans.accruePenalties(businessDate)`, переход SCHEDULED → DUE → OVERDUE по датам (сейчас OVERDUE ставится только при оплате).
- Досрочка: `POST /loans/:id/prepay { amountMinor, mode: REDUCE_TERM | REDUCE_INSTALLMENT }` с пересчётом графика и комиссией из продукта.
- Даты: перенос по рабочим дням через `dataHub.isWorkingDay`, корректная обработка 29–31 числа (не `setMonth`).
- Водопад погашения — конфигурируемый (пеня → просроченные % → просроченное тело → текущие % → тело).
- ФГПС: XIRR по всем денежным потокам (выдача, платежи, обязательные комиссии и страховки) на дату договора; печать в договоре и ДБО.
- AC: тесты на график с грейсом 3 мес, на 31-е число, на досрочку в обоих режимах, на начисление пени за 10 дней просрочки, на ФГПС эталонного кредита (сверка с Excel XIRR ±0,01 п.п.).

**P0-5. Пруденциальная и регуляторная отчётность ЦБА как данные** · L
- Сейчас: 4 жёстко прописанных шаблона в `regreporting.service.ts`.
- Сделать: `RegReportTemplate { code, institutionType, version, validFrom, definitionJson (строки → GL-маски/запросы), outputFormat }`, движок сборки + валидации (контрольные соотношения), экспорт XML/XLSX в формате ЦБА. Начальный пакет: оборотно-сальдовая, баланс, P&L, кредитный портфель по категориям (из P0-3), крупные риски, достаточность капитала, ликвидность; для БОКТ — свой набор.
- Переиспользовать `docs/adr/statform-engine.md` (в экосистеме уже есть движок статформ) — проверить, подходит ли он.
- AC: шаблоны грузятся из БД/seed без деплоя; отчёт за месяц собирается из GL и проходит контрольные соотношения; есть журнал версий шаблонов.
- Вне кода: получить у ЦБА актуальные формы и XSD/формат подачи [U].

**P0-6. AML: порог 20 000 AZN по наличным + нормальный файл СФМ + реальные списки** · M
- `modules/aml/aml-rules.engine.ts`: новое правило `CASH_THRESHOLD` (только кассовые операции: `TxnType.DEPOSIT/WITHDRAWAL` через cash/teller, порог 20 000 AZN или эквивалент по курсу ЦБА на дату) + срок отчёта 3 рабочих дня (дедлайн в алерте).
- `aml.service.ts`: генератор отчёта СФМ по реальной схеме (пока схемы нет — абстракция `FmnReportFormatter` + версия схемы), очередь «к подаче» с дедлайнами.
- Санкции: загрузка списков ООН/ЕС/OFAC и **национального списка** через data-hub (TZ §11), версионирование, повторный скрининг базы при обновлении списка.
- AC: наличный взнос 20 000 AZN → алерт с дедлайном T+3 рабочих дня; 19 999 → нет; файл СФМ проходит XSD; обновление списка запускает пересканирование клиентов.

### P1 — продуктовые разрывы под БОКТ и лизинг

**P1-1. Модуль лизинга `banking_leasing`** · XL
- Модели: `LeaseAsset { id, kind (AUTO/EQUIPMENT/REAL_ESTATE/OTHER), vin/serial, supplierId, priceMinor, vatMinor, insuredUntil, registryRef, status (ORDERED/DELIVERED/IN_LEASE/REPOSSESSED/SOLD/TRANSFERRED) }`, `LeaseContract { lesseeId, assetId, advancePct, residualValueMinor, buyoutOption, termMonths, rate, paymentScheme (ANNUITY/DIFF/SEASONAL/CUSTOM), insurancePaidBy, vatTreatment }`, `LeaseScheduleLine { principal, interest, vat, insurance, fees }`, `LeaseEvent` (поставка, акт приёма-передачи, изъятие, выкуп, переуступка).
- Учёт лизингодателя по МСФО 16: чистая инвестиция в лизинг, финансовый доход по ЭПС; операционный лизинг — актив + амортизация (связь с основными средствами `era-finance-core`).
- НДС: проценты по финансовому лизингу освобождены (L14); остальное — по параметру продукта; проверить актуальную редакцию НК [U].
- Интеграция: оплата поставщику (payment order), страховщик (связь с `InsuranceProduct`), ƏMDK/реестр транспорта для обременений [U].
- UI: `era-bank/app/leasing/*` (портфель, договор, предмет, график, события), в ДБО — график и платежи.
- AC: сквозной сценарий «заявка → покупка предмета → передача → 12 платежей → выкуп» с проводками; изъятие при DPD > N; отчёт по портфелю лизинга; ECL и резерв ЦБА применяются к лизингу.

**P1-2. Микрофинансы и БОКТ: группы и полевой офицер** · L
- Модели: `BorrowerGroup { id, name, centerId, officerId, meetingDay }`, `GroupMembership { role (LEADER/MEMBER), joinedAt }`, `LoanContract.groupId` + `liabilityType (INDIVIDUAL/JLG/SOLIDARITY)`, `FieldVisit`, `CollectionSheet`.
- Функции: групповая выдача, collection sheet на встречу, офлайн-сбор (PWA) с синхронизацией и идемпотентностью, портфель по офицеру.
- AC: группа из 5 человек → 5 JLG-кредитов одной операцией; collection sheet → пакетное погашение; отчёт PAR30 по офицеру.

**P1-3. Кредитное бюро и Центральный кредитный реестр** · M
- Расширить `bureau.adapter.ts`: кроме `pullScore` — `pullReport` (полная КИ), `submitCreditHistory` (массовая выгрузка + изменения статуса ≤ 30 дней), учёт согласия субъекта на запрос.
- Новый `modules/loans/credit-registry.adapter.ts` (ЦКР ЦБА): формирование и подача файлов, журнал подачи и ответов.
- EOD: очередь изменений статуса долга; алерт, если изменение не отправлено 25+ дней.
- AC: смена статуса кредита → запись в очереди; пакет формируется и в stub-режиме валидируется по схеме; дедлайн 30 дней отслеживается.

**P1-4. Боевые адаптеры AZIPS / XÖHKS / AÖS / SWIFT** · XL (по рельсу M–L)
- Вместо одного `StubRailAdapter` — по адаптеру на рельс (`azips.adapter.ts`, `xohks.adapter.ts`, `aos.adapter.ts`, `swift.adapter.ts`) с ISO 20022 (pacs.008/pacs.002/camt.053/camt.054), сверкой выписок, очередями повторов, 24/7 для AÖS (EOD не должен блокировать AÖS — нужен режим «posting during EOD» для мгновенных платежей).
- AC: в стенде ЦБА (когда будут доступы) хотя бы один ACK по каждому рельсу; автоматическая сверка camt.053 с GL.

**P1-5. Open Banking по стандарту ЦБА** · M
- `modules/dbo/dbo-open*.ts`, `OpenBankingConsent`: `expiresAt` обязателен и ≤ 90 дней, усиленная аутентификация при выдаче согласия (OTP/ASAN), эндпоинты в структуре Open Banking Manual v1.3, аутентификация шлюза ЦБА (x-Api-Key + JWT), реестр TPP.
- AC: согласие на 91 день отклоняется; AIS-ответы совпадают со схемой мануала; доступ без валидного согласия → 403.

**P1-6. МСФО 9 до «аудируемого» уровня** · L
- `modules/risk/ecl.engine.ts`: убрать двойной учёт залога (либо EAD без вычета залога + LGD с учётом залога, либо наоборот); 12m PD для стадии 1, lifetime для 2/3 (PD-кривые по сегментам), дисконтирование по ЭПС, 3 макро-сценария с весами, SICR не только по DPD (реструктуризация, watch-list, падение скоринга), оценка необеспеченной части линий (CCF).
- Хранить `EclParameterSet` с версией и утверждением (maker-checker уже есть).
- AC: unit-тест показывает, что залог учитывается один раз; отчёт о движении резерва (stage transfers); воспроизводимость по версии параметров.

**P1-7. Налоги: удержание налога с процентов по вкладам** · S–M
- `modules/deposits/deposits.service.ts` (`accrueDailyInterest`/выплата): налоговый агент; правило из Product Factory (`taxExemptMonthlyMinor = 20000`, `exemptIfTermMonths >= 18`, ставка), проводка удержания на GL «налог к уплате», реестр для finance-core (подача в e-taxes).
- AC: вклад с процентом 500 AZN/мес → налог на 300 AZN (если в 2027 г. ставка не изменится [U]); 18-месячный вклад → 0.

**P1-8. Интеграция ASAN İmza / SİMA и удалённая идентификация** · M
- Переиспользовать `AsanSimaGovSignatureAdapter` из `era-finance-core` (ADR `asan-sima-gov-signature.md`) вместо `asan-sima-stub.adapter.ts`; подписание кредитного договора/согласия в ДБО; повышение `kycTrustTier` → `GOVERNMENT_VERIFIED` с публикацией в MDM (сейчас лог «MDM trust upgrade stub»).
- AC: онлайн-заявка → подпись SİMA → договор с хешем подписи → кредит выдаётся без визита в отделение (если разрешено правилами ЦБА [U]).

**P1-9. Залоги как сущность** · M
- `CollateralItem { type, ownerId, valuationMinor, haircutPct, registry (ƏMDK/транспорт/движимое), encumbranceRef, insuredUntil }`, связь many-to-many с кредитами и лизингом, переоценка по графику, использование в ECL/ЦБА-категориях. Убрать `collateralRef` как JSON-строку.
- AC: один залог на 2 кредита распределяется по долям; истёкшая переоценка → флаг в риск-отчёте.

### P2 — масштабирование и конкурентные фичи

| # | Задача | Effort | Файлы / где | AC |
|---|--------|--------|-------------|-----|
| P2-1 | Статус `SCAFFOLD` в Inventory + понизить завышенные строки (LEASE, MFI, FMN, MENT, MIS/BPM/DMS, AML-SCR) | S | `docs/acceptance/Bank-Capability-Inventory.md`, `check:acceptance` | Нет строк `IN`, у которых сервис < 3 КБ без тестов |
| P2-2 | Вебхуки/стриминг событий для внешних интеграторов (как у Mambu): `loan.disbursed`, `payment.settled`, `account.blocked` и т.д., подпись HMAC, повторы | M | `integration/orchestrator-events.publisher.ts` → новый `webhooks` модуль | Подписка клиента, доставка с ретраями, проверка подписи |
| P2-3 | Конструктор отчётов / витрина данных (MIS) поверх read-replica | L | `platform-extras` → реальный `mis` | Пользователь собирает отчёт без кода; выгрузка XLSX |
| P2-4 | Configuration-as-code для продуктов: экспорт/импорт Product Factory в YAML с версиями и diff | M | `kernel/product-factory/*` | Продукт переносится dev → prod файлом; история версий |
| P2-5 | Реестр вкладчиков ADİF и расчёт взносов | M | `deposits`, `regreporting` | Файл реестра по форме ADİF [U] |
| P2-6 | Портал/ДБО для лизингополучателя и заёмщика БОКТ (график, ФГПС, досрочка онлайн) | M | `era-bank-dbo/app/(customer)/loans|leasing` | Клиент видит график и может подать заявку на досрочку |
| P2-7 | SHARED-пул с локализацией данных в АР (L10) | L | ADR `deployment-topology.md` | Документ и тест: ПДн и банковская тайна физически в АР, шифрование end-to-end |
| P2-8 | Боевой процессинг карт (AzeriCard / MilliKart) | L | `cards/gateway/*` | Авторизация и клиринг на стенде процессинга |
| P2-9 | Пенсии / PSA / multi-entity — либо довести, либо убрать из продаваемого каталога | S (решение) | `modules/pension`, `psa`, `multi-entity` | Решение владельца зафиксировано в ADR |

### Рекомендуемая последовательность (≈ 6 месяцев для 2–3 разработчиков)

1. **Месяц 1:** P0-1, P0-2, P2-1 (честный Inventory), начало P0-4.
2. **Месяцы 2–3:** P0-4, P0-3, P0-6, P1-6 (исправить двойной учёт залога сразу).
3. **Месяцы 3–4:** P0-5, P1-3, P1-7, P1-9.
4. **Месяцы 4–6:** P1-1 (лизинг), P1-2 (МФО), P1-5, P1-8; P1-4 — по мере получения доступов ЦБА.

---

## 10. Что нужно вне кода (от бизнеса и юристов)

- Актуальные **формы пруденциальной отчётности ЦБА** для банка и для БОКТ + формат подачи (XML/XSD, канал).
- **Формат отчёта СФМ** и доступ к тестовому эндпоинту.
- Доступы к **стендам AZIPS / XÖHKS / AÖS** (участник через банк-партнёр или напрямую) и SWIFT (через сервис-бюро).
- Договор с **АКБ** (или другим бюро) и регламент обмена с **ЦКР ЦБА**.
- Договор с процессингом (AzeriCard / MilliKart) для боевых карт.
- Партнёрский доступ **ASAN İmza / SİMA** (в finance-core уже есть шов).
- Юрист: подтвердить пункты, помеченные [U] (номера законов о ПОД/ФТ и о платёжных системах, налоговая редакция 2027 по вкладам, НДС по лизингу, правила удалённой идентификации, раскрытие ФГПС, лимит ADİF).
- Методолог по рискам: параметры PD/LGD и сегменты для МСФО 9, независимая валидация.

---

## 11. Источники

**Код и документы проекта:** см. раздел 1. Ключевые файлы, на которых основаны выводы: `schema.prisma`, `posting-engine.service.ts`, `loan-schedule.util.ts`, `loan-repay.util.ts`, `loan-risk.util.ts`, `loans.service.ts`, `eod.service.ts`, `ecl.engine.ts`, `regreporting.service.ts`, `aml-rules.engine.ts`, `aml.service.ts`, `sanctions-seed.json`, `bureau.adapter.ts`, `stub-rail.adapter.ts`, `product-params.ts`, `OPEN-TASKS.md`, `Bank-Capability-Inventory.md`.

**Вендоры:**
- Colvir: https://colvir.com/en/products/colvir_banking_system · https://colvir.com/en/products/colvir_microfinance_core · https://colvir.com/storage/files/presentations/Colvir%20catalog.pdf · https://colvir.com/en/customers/ziraat-bank · https://colvir.com/en/customers/azerpost · https://www.trend.az/business/3526114.html
- R-Style RS-Bank: https://www.softlab.ru/blog/korobochnaya-versiya-rs-bank-v-6/ · https://www.cnews.ru/news/line/2018-09-19_rstyle_softlab_realizovala_trebovaniya_po_msfo · https://banco.az/ru/news/bank-of-baku-obnovit-avtomatizirovannuyu-bankovskuyu-sistemu · tadviser (Bank Respublika)
- Mambu: https://mambu.com/en/lending · https://mambu.com/en/core-capabilities · https://docs.mambu.com/docs/accounting-setup/ · https://aws.amazon.com/marketplace/pp/prodview-sdfc7nife3qe6
- Apache Fineract / Mifos X: https://fineract.apache.org/docs/legacy/ · https://mifos.org/mifos-x/ · https://cwiki.apache.org/confluence/spaces/FINERACT/pages/75975654/Group-Based+Financial+Inclusion+Methodologies
- Oradian: https://oradian.com/solutions/microfinance · https://oradian.com/case-studies/lardi
- CFT в АР (исторически VTB-Azerbaijan): IBS BOSS Guide 2010 (abcdocz.com/doc/273058)

**Регуляторика АР:**
- БОКТ: https://e-qanun.az/framework/19197 · https://www.cbar.az/law-2/the-law-of-the-republic-of-azerbaijan-on-non-bank-credit-institutions
- Резервы ЦБА: https://www.cbar.az/law-30/decision-no-1851100014 · https://e-qanun.az/framework/50081 · https://e-qanun.az/framework/40823
- ПОД/ФТ: https://uploads.cbar.az/assets/e16bcadfeeeeb15950195dd9f.pdf · https://president.az/az/articles/view/58762
- Кредитные бюро: https://www.cbar.az/law-200/law-no-384-vq · https://acb.az/legislation
- AÖS: https://www.cbar.az/page-479/instant-payments-system-ips · https://www.cbar.az/press-release-2757/mrkzi-bank-ani-odnislr-sistemini-real-rejimd-istismara-vermisdir · https://uploads.cbar.az/assets/ea726cd499b78e06fc32db751.pdf
- Open Banking: https://uploads.cbar.az/assets/1bfa75c99bbb602c84e5cbbd8.pdf · https://uploads.cbar.az/assets/065690085c3fa24081c3e4fa7.pdf · https://www.cbar.az/press-release-4941/statement-on-approved-requirements-for-open-banking?language=en
- Инфобезопасность и облако: https://uploads.cbar.az/assets/Information%20security%20requirements%20for%20supervised%20entities%20in%20financial%20markets%20.pdf
- Налоги: https://stabil.az/en/news/bank-deposits-to-be-taxed-from-next-year · https://taxsummaries.pwc.com/azerbaijan/corporate/other-taxes · https://economy.gov.az/en/post/1805/maliyye-lizinqi-ile-bagli-qanunvericiliyin-muddealari-tekmillesdirilib
