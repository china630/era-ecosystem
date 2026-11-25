# Аудит реализации рекомендаций из `bank-satellite-gap-analysis.md`

**Дата аудита:** 25.11.2026, около 01:57 (Asia/Baku, UTC+4)  
**Аудитор:** Мика (только чтение; код, миграции и документы проекта не менялись)  
**Объект:** незакоммиченные правки Cursor по банковскому сателлиту ERA (`era-bank-core`, `era-bank`, `era-bank-dbo`, `docs/adr/bank/`, acceptance-матрицы)  
**Эталон:** исходный gap-анализ от 25.11.2026 01:01 и задачи P0/P1/P2 из него  
**Прогон тестов:** не выполнялся. Тяжёлый typecheck не запускался (лимит 16 ГБ RAM). Выводы — по статическому разбору кода, схемы, миграций, тестов и документов.

Обозначения: **сделано** · **частично** · **не сделано**.

---

## 0. Коротко

Cursor действительно начал закрывать разрывы из gap-анализа: в рабочем дереве много нового кода, 8 новых Prisma-миграций, юнит-тесты и правки Inventory. **Ничего из этого не закоммичено.** План `.cursor/plans/bank-cbs-full.plan.md` помечает все волны как `completed`, но это завышение.

| Статус | Число пунктов P0–P2 (из 24) |
|--------|------------------------------|
| Сделано | **2** (P2-1 честность Inventory — с оговоркой; P2-9 решение по pension/PSA) |
| Частично | **19** |
| Не сделано | **3** (P1-4 боевые рельсы; P2-6 ДБО лизинг/досрочка; P2-8 боевой процессинг карт) |

Критический дефект **двойного учёта залога в МСФО 9** в режиме `PD_LGD` **исправлен**. Критический дефект **гонки остатка** в ядре проводок **закрыт в posting engine**, но не везде: казначейство по-прежнему пишет остаток напрямую, а тест конкуренции — не настоящий (последовательная симуляция в памяти, не 50 параллельных дебетов к БД).

---

## 1. Целостность исходного gap-анализа

| Копия | Путь | Размер | Состояние |
|-------|------|--------|-----------|
| Оригинал у пользователя | `C:\Users\ASUS G752VT\bank-satellite-gap-analysis.md` | **62 948 байт**, 25.11.2026 01:01 | **Цел**, это тот файл, который клали в проект |
| Копия на box | `/workspace/bank-satellite-gap-analysis.md` | тот же оригинал | Цел |
| Путь в проекте | `D:\My Projects\era-ecosystem\docs\adr\bank-satellite-gap-analysis.md` | **340 байт**, 25.11.2026 01:28 | **Заменён заглушкой** («Moved. Canonical copy: ./bank/README.md») |

Содержимое разнесли в `docs/adr/bank/`, но **это не настоящее разбиение**. Файлы `00-gap-vs-cbs-benchmarks.md` (64 326), `01-az-regulatory.md` (63 092) и `02-remediation-backlog.md` (63 380) в заголовке обещают §§0–7, §8 и §§9–11, а внутри у всех трёх есть **все разделы 0–11** — по сути три копии исходного документа с разными шапками. Текст «код НЕ менялся» в этих копиях уже неверен: код как раз меняли.

Одновременно **корневые банковские ADR заменены заглушками** (172–229 байт): `docs/adr/era-bank-core.md`, `era-bank-risk-and-audit.md`, `era-bank-gl-account-mapping.md`, `era-bank-product-params.md`, `bank-domain-permissions-and-rbac.md`, `bank-multi-entity-holding.md`. Канон переехал в `docs/adr/bank/*.md`. Старые ссылки открывают заглушку, а не текст решения.

Новые короткие ADR (их в исходном gap-анализе не было): `03-external-blockers.md`, `bank-shared-az-residency.md`, `bank-pension-psa-multi-entity-decision.md`.

---

## 2. Git

- `git log --since=2026-11-20 -- era-bank*` — **пустой**. Последние коммиты, которые вообще касаются `era-bank-core`, давние и не про этот gap (`6b2a9fab53` и старше).
- Вся реализация — **незакоммиченное рабочее дерево**: около **116** путей по банку (изменённые + новые). Миграции, новые модули, тесты, ADR-пак, Inventory и матрицы не в истории git.
- Новых файлов (untracked) много: `era-bank-core/apps/api/src/modules/{leasing,mfi,mis,webhooks}/`, адаптеры рельсов, `posting-money-tx.ts`, 8 миграций `20260821*` / `20261125*`, 14 новых `*.spec.ts`.
- Риск: без коммита и без `db:migrate` на окружениях схема в коде разойдётся с БД. Generated Prisma client тоже изменён, но не закоммичен.

---

## 3. Сводка по задачам P0 / P1 / P2

### P0

| ID | Задача | Статус | Доказательства |
|----|--------|--------|----------------|
| **P0-1** | Изоляция и блокировки в posting engine | **частично** | Сделано в ядре: `runSerializableMoneyTx` (Serializable + retry P2034) и `lockAccountsForUpdate` (`SELECT … FOR UPDATE` по id по возрастанию) в `era-bank-core/apps/api/src/kernel/posting-engine/posting-money-tx.ts`; `posting-engine.service.ts` вызывает их в `post` и `approve`. Касса идёт через `teller-posting.service.ts` → `postingEngine.post`, значит тоже под замком. **Не закрыто:** в `treasury.service.ts` по-прежнему прямые `ledgerBalanceMinor: { decrement/increment }` (строки 271, 337, 858) **в обход** posting engine и без FOR UPDATE. `availableBalanceMinor` по-прежнему увеличивается тем же `increment`, что и ledger, а не пересчитывается из холдов. Тест `posting-concurrency.spec.ts` **не бьёт в БД**: «50 параллельных дебетов» — это цикл `for` по переменной в памяти. AC из gap-анализа не выполнен. |
| **P0-2** | Тип организации BANK / BOKT / LEASING | **частично** | Enum `InstitutionType { BANK, BOKT, LEASING_COMPANY, CREDIT_UNION }` и модель `BankInstitutionConfig` в `schema.prisma`. Гейт `assertInstitutionAllowsProductKind` в `institution-type.util.ts` запрещает БОКТ активировать `TERM_DEPOSIT/SAVINGS/CALL_DEPOSIT/STRUCTURED_DEPOSIT` (вызывается из `product-factory.service.ts`). **Нет** бандлов `banking_bundle_nbco` / `banking_bundle_leasing` в каталоге модулей. Для `LEASING_COMPANY` отдельных ограничений нет. Seed всегда ставит `InstitutionType.BANK`. UI настроек типа организации нет. |
| **P0-3** | Резервы по правилам ЦБА | **частично** | Движок `prudential-classification.engine.ts`: 6 категорий, «худшая из просрочки и качества», ставки из `PrudentialRateTable`. Сервис `prudential-provisioning.service.ts` гоняет пакет в EOM (`eod.service.ts`), проводит дельту резерва через posting engine на `PRUDENTIAL_EXPENSE/ALLOWANCE`, maker-checker есть. Тест `prudential-classification.spec.ts`. **Дыры:** `qualityFlags` с договора **всегда `[]`**, качественные признаки можно передать только через `qualityOverrides` в API. Категория не пишется обратно на `LoanContract`. **Списания ümidsiz за счёт резерва нет.** Страницы `era-bank/app/risk/prudential/` нет. |
| **P0-4** | Начисления, пени, грейс, досрочка, ФГПС | **частично** | Поля на `LoanContract`: `accruedInterestMinor`, `gracePrincipalMonths`, `penaltyRateAnnual` (`Float?`), `aprPercent` (`Float?`), частота. EOD вызывает `loans.accrueDailyInterest` и `accruePenalties`. График умеет грейс, MONTHLY/QUARTERLY/BULLET, даты через `addCalendarMonths` (31 января больше не «перескакивает»). `POST /loans/:id/prepay` с режимами `REDUCE_TERM` / `REDUCE_INSTALLMENT`. ФГПС: `apr.util.ts` (XIRR) считается при выдаче. Тесты `loan-penalty-accrual.spec.ts`, `apr.util.spec.ts`, правки `loan-schedule.spec.ts`. **Дыры / баги** — см. §5 (досрочка не в одной транзакции с проводкой, `Date.now()` в ключах идемпотентности, водопад без пени, нет переноса по рабочим дням ЦБА). |
| **P0-5** | Отчётность ЦБА как данные | **частично** | Появились `RegReportTemplate`, `reg-report.engine.ts`, каталог `reg-report-template.catalog.ts`, миграция `20260821150000_reg_report_templates`, тест `reg-report.engine.spec.ts`. Живая подача в ЦБА по-прежнему fail-closed (`BANK_CBAR_MODE=live` требует адаптер, которого нет). Официальных XSD ЦБА в репозитории нет. |
| **P0-6** | AML 20 000 AZN + файл СФМ + списки | **частично** | Правило `CASH_THRESHOLD`, порог `2_000_000` миноров = 20 000 AZN, только касса (`DEPOSIT/WITHDRAWAL` + префикс `CASH-IN-`/`CASH-OUT-` или GL кассы). Дедлайн T+3 через `addBusinessDaysSync`. Форматтер `fmn-report-formatter.ts` пишет более полный XML, схема всё ещё `FMN-TEST-1`. **Санкционный список не обновлён:** `sanctions-seed.json` — те же 4 демо-имени. Загрузки ООН/ЕС/OFAC/нацсписка из data-hub нет. «Рабочие дни» = сб/вс, без календаря ЦБА. |

### P1

| ID | Задача | Статус | Доказательства |
|----|--------|--------|----------------|
| **P1-1** | Модуль лизинга | **частично** | Модели `LeaseAsset`, `LeaseContract`; модуль `modules/leasing/*` (~4 КБ сервис); API `GET/POST /leasing/assets`, `GET/POST /leasing/contracts` — создание предмета и договора, опционально связанный `LOAN_LEASE`. Тест `leasing-mvp.spec.ts`. **Нет:** графика лизинговых платежей с НДС, аванса/выкупа в проводках, МСФО 16, изъятия, страхования, UI `era-bank/app/leasing`, ДБО, ключа модуля `banking_leasing`. |
| **P1-2** | Группы и полевой офицер (БОКТ/МФО) | **частично** | `BorrowerGroup`, `GroupMembership`, `LoanContract.groupId` / `liabilityType`; API `/mfi/groups`, activate, `originate-jlg`. Тест `mfi-group.spec.ts`. **Нет:** collection sheet, полевых визитов, офлайн-сбора, отчёта PAR30 по офицеру, UI. |
| **P1-3** | АКБ и Центральный кредитный реестр | **частично** | `bureau.adapter.ts` расширен `pullReport` / `submitCreditHistory` (live за флагом, иначе stub). Новые `credit-registry.adapter.ts` / `credit-registry.service.ts`, очередь `CreditDebtStatusQueueItem`, шаг EOD `runEodDebtStatusAlerts`. Stub-подача возвращает `provider: "STUB_CKR_SUBMITTED"` — успех симулируется. Боевого обмена нет. |
| **P1-4** | Боевые адаптеры AZIPS / XÖHKS / AÖS / SWIFT | **не сделано** | Появились отдельные классы и `PaymentRailAdapterFactory`, но каждый внешний адаптер вызывает один и тот же `submitExternalRailStub` (`pacs.008 * stub`, `simulatedAck: true`). В live-режиме по-прежнему `ConfigError`. ISO-сообщений, camt.053 и особого режима AÖS во время EOD нет. Это перекладка старой заглушки, а не интеграция. |
| **P1-5** | Open Banking по стандарту ЦБА | **частично** | `validateOpenBankingConsentExpiry`: `expiresAt` обязателен, максимум 90 дней (`open-banking-consent.util.ts`, тест `open-banking-consent.spec.ts`). На Open API ключах уже есть `X-Api-Key`. **Нет:** шлюза ЦБА, JWT+ключа по мануалу v1.3, структуры AIS/PIS из мануала, принудительной усиленной аутентификации при выдаче согласия, реестра TPP. Inventory по-прежнему держит `CAP-DBO-OB = IN`. |
| **P1-6** | МСФО 9 до аудируемого уровня | **частично** | **Двойной учёт залога исправлен** в `ecl.engine.ts`: при `PD_LGD` EAD = полная задолженность, залог только в LGD; при `STAGE_FLAT` залог вычитается из EAD один раз. Тест `ecl-engine.spec.ts`. **Не сделано** из AC: 12-месячный vs lifetime PD, дисконтирование по ЭПС, 3 макро-сценария, SICR кроме DPD, CCF по невыбранным линиям. ECL по-прежнему читает старый `collateralRef` JSON (`risk.service.ts`), а не сумму `LoanCollateralLink`. |
| **P1-7** | Налог у источника с процентов по вкладам | **частично** | `deposit-interest-wht.util.ts` подключен в `deposits.service.ts`, GL `DEPOSIT_INTEREST_TAX_PAYABLE`, тест `deposit-interest-wht.spec.ts`. Баг: налог считается как `Number(incrementalTaxable) * rate` — **деньги через float**. Ставку и порог 200 AZN нужно сверять с окончательной редакцией НК на 2027 год [U]. |
| **P1-8** | ASAN İmza / SİMA | **частично** | Новый `asan-sima.adapter.ts`: stub и «live» `FinancePortAsanSimaAdapter`. **Live `startChallenge` делает `void fetch(...).catch(...)` и сразу возвращает `transactionId`**, даже если HTTP упал. `completeChallenge` в live **бросает** `ConfigError`. Старый `AsanSimaStubAdapter` сохранён и в live тоже бросает. Это не переиспользование боевого адаптера из `era-finance-core`. Повышение MDM trust, судя по OPEN-TASKS и этому шву, полноценно не закрыто. |
| **P1-9** | Залоги как сущность | **частично** | Модели `CollateralItem`, `LoanCollateralLink` (M2M), `collateral.service.ts`. При attach сервис дополнительно пишет снимок в старый `collateralRef`. Отдельного реестра ƏMDK, графика переоценки и учёта одного залога на несколько кредитов в ECL (через links) нет. UI залогов — прежний `/risk/collateral`. |

### P2

| ID | Задача | Статус | Доказательства |
|----|--------|--------|----------------|
| **P2-1** | Статус SCAFFOLD и понижение завышенных строк | **сделано** (с оговоркой) | В `Bank-Capability-Inventory.md` добавлен `SCAFFOLD`; LEASE/MFI → PARTIAL; MENT/AGENCY/MIS/BPM/DMS/INV/PEN/PSA/WEBHOOK → SCAFFOLD; FMN вынесен в `CAP-AML-FMN = DECLARED`. **Остаток нечестности:** `CAP-CARD-ATM`, `CAP-TR-AM` и ряд AML-строк (RTF/PEP/ML) всё ещё `IN`, хотя это lab/stub. |
| **P2-2** | Вебхуки с HMAC и ретраями | **частично** | Модуль `modules/webhooks/*`, подпись, подписка. В сервисе прямо написано: delivery queue и retries **не реализованы**, `delivered: false`. |
| **P2-3** | Конструктор отчётов / MIS | **частично** | `mis.service.ts` (~1,3 КБ) только перечисляет ключи шаблонов. Не конструктор и не витрина. Inventory честно ставит SCAFFOLD. |
| **P2-4** | Configuration-as-code YAML | **частично** | `product-template-yaml.util.ts` + тест. Inventory: «YAML import/export scaffold, not config-as-code ga». |
| **P2-5** | Реестр вкладчиков ADİF | **частично** | По-прежнему тег + счётчик в EOD. Официального файла реестра нет. Inventory: PARTIAL. |
| **P2-6** | ДБО: график, ФГПС, досрочка, лизинг | **не сделано** | Новых страниц в `era-bank-dbo/app` нет. |
| **P2-7** | SHARED-пул и локализация данных в АР | **частично** | Только ADR `bank-shared-az-residency.md` со статусом DECLARED. Пул не построен. |
| **P2-8** | Боевой процессинг карт | **не сделано** | Шлюз по-прежнему mock (`mock-azericard.gateway.ts`). Появился только `cards/gateway/README.md`. |
| **P2-9** | Pension / PSA / multi-entity: довести или убрать из продажи | **сделано** (решение) | ADR `bank-pension-psa-multi-entity-decision.md`; в Inventory — SCAFFOLD, «do not sell». Код модулей не удаляли и не углубляли — это и было допустимым исходом. |

План `bank-cbs-full.plan.md` отмечает **все** эти пункты как `[x] completed`, включая P1-4 и P2-6/P2-8. Это не соответствует коду.

---

## 4. Критические дефекты из gap-анализа

### 4.1. Гонка проверки остатка и списания (P0-1)

**Было:** `prisma.$transaction` без isolation, проверка доступного остатка, затем `increment` без блокировки строки.

**Сейчас в posting engine — исправлено:** Serializable + `SELECT id FROM accounts WHERE id = $1 FOR UPDATE` (счета сортируются), затем проверка `ledger − холды + овердрафт`.

**Остаётся риск:**

1. `treasury.service.ts` меняет `ledgerBalanceMinor` напрямую (три места). Это обход ядра и ADR D6.
2. Тест `posting-concurrency.spec.ts` не проверяет гонку в PostgreSQL. Implementation Matrix всё равно ссылается на него как на доказательство AC-BNK-CORE.
3. Поле `availableBalanceMinor` может разъехаться с холдами.

### 4.2. Двойной учёт залога в МСФО 9 (P1-6)

**Было:** в `PD_LGD` залог вычитался из EAD и одновременно снижал LGD.

**Сейчас — исправлено** в `calculateLoanEcl` / `computeEadMinor(..., methodology)`. Комментарий в файле это фиксирует. До аудируемого МСФО 9 (lifetime, сценарии, дисконт, SICR) по-прежнему далеко.

---

## 5. Баги и риски в новом коде

1. **Досрочка не атомарна.** В `loans.service.ts` `prepay()` сначала `postingEngine.post(...)`, затем отдельно `loanContract.update` и пересчёт графика. Если обновление договора упадёт, деньги со счёта уйдут, а `outstandingMinor` останется прежним.
2. **Ключ идемпотентности досрочки содержит `Date.now()`** (`loan-prepay-${id}-...-${Date.now()}` и reference тоже). Повторный запрос не защищён, двойной клик может провести дважды.
3. **Начисление процентов по кредиту:** если у договора нет `accountId`, начисление в поле всё равно увеличивается, а проводки нет — разъезд учёта и регистра.
4. **Казначейство без замков** — см. §4.1.
5. **Деньги/налог через `Number`:** `deposit-interest-wht.util.ts` (`Number(incrementalTaxable) * rate`); в графике кредита по-прежнему `Number(remaining) * periodRate`. Для больших сумм возможна потеря точности. `penaltyRateAnnual` и `aprPercent` в схеме — `Float`.
6. **ASAN live: ложный успех.** `startChallenge` всегда возвращает успешный старт; сбой HTTP только пишется в лог. `completeChallenge` в live не работает.
7. **Stub как успех.** Рельсы: `accepted: true`, `simulatedAck: true`. ЦКР: `STUB_CKR_SUBMITTED`. Вебхуки собирают подпись, но не доставляют (`delivered: false` хотя бы честно указан).
8. **Качественные признаки ЦБА не живут на договоре** — классификация почти всегда только по DPD.
9. **Нет списания ümidsiz.**
10. **Нет UI** под лизинг, МФО, пруденциальные резервы, досрочку, вебхуки. API есть, операционист из `era-bank` этим не пользуется. Прав в `permissions.ts` на `leasing` / `mfi` / `prudential` нет (страниц тоже нет — пока дыра закрыта отсутствием маршрута).
11. **Миграции не в git и, скорее всего, не применены** на рабочих БД. 8 папок: `20260821130100_institution_type`, `...140000_prudential_classification`, `...150000_reg_report_templates`, `20261125010000_loan_credit_engine_p0_4`, `...120000_leasing_mfi`, `...130000_collateral_openbanking`, `...140000_deposit_wht_rails`, `...150000_bank_p2_webhooks_mis`.
12. **Рабочие дни СФМ** считают только выходные, не производственный календарь АР (`dataHub.isWorkingDay` не используется). В графике кредита переноса на рабочий день тоже нет.
13. **Водопад погашения** в `loan-repay.util.ts` по-прежнему «проценты → тело», без пени первым этапом.

---

## 6. Расхождения документов и кода

### Документы говорят «готово», код слабее

| Документ | Утверждение | Факт |
|----------|-------------|------|
| `.cursor/plans/bank-cbs-full.plan.md` | Все волны P0–P2 `completed` / `[x]` | 19 пунктов частичные, 3 не сделаны |
| `Bank-Implementation-Matrix.md` | P0-1 доказан тестом `posting-concurrency.spec.ts`; AC-BNK-CORE ✅ | Тест не ходит в БД и не запускает параллельные проводки |
| `Bank-Implementation-Matrix.md` | AC-BNK-PAY ✅, в т.ч. «P0-4 … APR ±0.01pp» | Движок есть, но досрочка с дырой в транзакции; UI досрочки нет |
| `Bank-Capability-Inventory.md` | `CAP-DBO-OB = IN` | Проверен только лимит согласия 90 дней, не стандарт ЦБА |
| `docs/adr/bank/*.md` (00/01/02) | «Статус: рекомендации, код НЕ менялся» | Код уже меняли; три файла — почти полные копии, не разрезы |
| План / матрица | P1-4 «per-rail factory» как закрытие | Адаптеры — обёртки над тем же stub |

### Документы честнее или уже поправлены (совпадает с кодом)

- Inventory понизил LEASE/MFI, вынес FMN в DECLARED, ввёл SCAFFOLD, не продаёт PEN/PSA.
- Product Readiness: edition `mvp`, `pilot_ready: false`; UI лизинга/МФО/пруденциала — 🟡 follow-up.
- ADR `docs/adr/bank/era-bank-core.md` D6 обновлён: «Serializable + SELECT FOR UPDATE». Для posting engine это верно, для treasury — нет (документы это не оговаривают).
- `OPEN-TASKS.md` и `03-external-blockers.md` по-прежнему честно ждут партнёрские стенды.

### Код ушёл вперёд, документы/UI отстали

- Нет экранов и пунктов меню под `/leasing`, `/mfi`, `/risk/prudential`, досрочку.
- В `permissions.ts` нет новых ключей под эти API.
- В `MODULES_CATALOG.md` / `era-bank-core-module-map.mdc` нет `banking_leasing` и бандлов БОКТ/лизинг.
- Корневые пути ADR — заглушки: кто открывает `docs/adr/era-bank-core.md` по старой ссылке, не видит текст, пока не перейдёт в `docs/adr/bank/`.
- Исходный цельный `docs/adr/bank-satellite-gap-analysis.md` в проекте больше не лежит — только stub + три дублирующих файла.

### PRD / TZ / edition

- `era-bank-core/PRD.md` и edition `docs/editions/bank.yaml`: `mvp`, `pilot_ready: false` — это верно, продавать как GA нельзя.
- TZ по-прежнему описывает Serializable; реализация в ядре теперь ближе к TZ, чем до правки.

---

## 7. Что нужно сделать дальше (порядок)

1. **Не считать план выполненным.** Закоммитить только после починки блокеров ниже и после `db:migrate` + `db:seed` на стенде.
2. **P0-1 добить:** убрать прямые update остатка в treasury (только posting engine); настоящий интеграционный тест на 50 параллельных дебетов; пересчёт `availableBalanceMinor`.
3. **Починить досрочку:** одна транзакция «проводка + outstanding + график», стабильный idempotency key без `Date.now()`.
4. **Не выдавать stub за успех** в рельсах, ЦКР и ASAN live (`startChallenge`).
5. **Не обещать полный P1-1/P1-4/P1-6/P1-8** — это MVP/лаборатория, пока нет МСФО 16, боевых рельсов, аудируемого ECL и живого ASAN.
6. Вернуть в репозиторий **один цельный** gap-анализ (или реально разрезать файлы 00/01/02, убрав дубли) и не оставлять в копиях фразу «код не менялся».

---

## 8. Источники аудита (ключевые файлы)

`era-bank-core/apps/api/src/kernel/posting-engine/{posting-money-tx.ts,posting-engine.service.ts,teller-posting.service.ts}`  
`era-bank-core/apps/api/src/modules/risk/{ecl.engine.ts,prudential-classification.engine.ts,prudential-provisioning.service.ts,risk.service.ts}`  
`era-bank-core/apps/api/src/modules/loans/{loans.service.ts,loan-schedule.util.ts,loan-repay.util.ts,apr.util.ts,loan-date.util.ts,loan-interest.util.ts,bureau.adapter.ts,credit-registry.*}`  
`era-bank-core/apps/api/src/modules/{leasing,mfi,payments,aml,dbo,deposits,webhooks,mis}/*`  
`era-bank-core/apps/api/src/integration/asan-sima.adapter.ts`  
`era-bank-core/apps/api/src/modules/treasury/treasury.service.ts`  
`era-bank-core/packages/database/prisma/schema.prisma` и `prisma/migrations/20260821*`, `20261125*`  
`era-bank-core/apps/api/__tests__/posting-concurrency.spec.ts` и остальные новые `*.spec.ts`  
`docs/adr/bank-satellite-gap-analysis.md` (stub), `docs/adr/bank/*`  
`docs/acceptance/Bank-Capability-Inventory.md`, `Bank-Implementation-Matrix.md`, `Bank-Product-Readiness-Matrix.md`  
`.cursor/plans/bank-cbs-full.plan.md`
