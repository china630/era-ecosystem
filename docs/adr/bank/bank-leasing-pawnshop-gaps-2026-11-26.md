# ERA Bank — план доработок для лизинговых компаний и ломбардов (плюс пробелы BOKT и ДБО)

**Дата:** 26.11.2026, около 01:50 (Asia/Baku, UTC+4)  
**Статус:** план / рекомендации. Этим документом **код не менялся**.  
**Автор:** Мика (сверка по коду для Чингиза)  
**Область:** `era-bank-core` (движок) · `era-bank` (ops UI) · `era-bank-dbo` (клиентский веб-портал / ДБО)  
**Канон, с которым сверялись:** [Bank-Capability-Inventory.md](../../acceptance/Bank-Capability-Inventory.md) · [Bank-Product-Readiness-Matrix.md](../../acceptance/Bank-Product-Readiness-Matrix.md) · [Bank-DBO-Product-Readiness-Matrix.md](../../acceptance/Bank-DBO-Product-Readiness-Matrix.md) · [`docs/editions/bank.yaml`](../../editions/bank.yaml) · [02-remediation-backlog.md](./02-remediation-backlog.md) · [03-external-blockers.md](./03-external-blockers.md) · fact sheet `/workspace/nonbank-sales/product-facts.md`

Индекс банковских ADR: [README.md](./README.md). Корневые пути `docs/adr/BANK-AUDIT-*.md` и `docs/adr/bank-satellite-gap-analysis.md` — соседние аудиты / заглушки; этот файл живёт **здесь**, в `docs/adr/bank/`, как остальные банковские решения.

---

## 0. Контекст и статус платформы

Вся линейка `bank` и `bank-dbo` находится в статусе **`edition: mvp`**, **`pilot_ready: false`** (`docs/editions/bank.yaml`). Внутренние расчётные и учётные модули рабочие (кредитное ядро, GL с двойной записью, касса, филиалы, lab-контуры лизинга и MFI, веб-ДБО). Живые внешние интеграции (AZIPS / XÖHKS / AÖS / SWIFT, ASAN İmza / SİMA, AKB / ЦКР, AzeriCard / MilliKart, официальная сдача CBAR / FMN) — **заглушки или fail-closed** до партнёрских ключей и сертификации ([03-external-blockers.md](./03-external-blockers.md)).

Целевые клиенты этого плана — **лизинговые компании**, **ломбарды** и (смежно) **BOKT**. Банкам малого/среднего размера этот документ не расширяет scope Full CBS.

Честная оценка «продавать сегодня»:

| Сегмент | Можно показывать как MVP/lab | Нельзя обещать «из коробки под ключ» |
|---------|------------------------------|--------------------------------------|
| **BOKT** | Кредитный конвейер, JLG-группы, ведомости сбора, PAR30, касса/филиалы, веб-кабинет с графиком и досрочкой, гейт депозитов, lab-пакет отчётов ЦБА и 6 пруденциальных категорий | Живой обмен с АКБ/ЦКР, живая сдача отчётности в ЦБА, единый rollback ведомости сбора, кабинет группового заёмщика |
| **Лизинг** | Каталог предметов, договор с авансом и остаточной стоимостью, lab-график IFRS 16, расчёт выкупа, чтение графика в ДБО, гейт `LEASING_COMPANY` | НДС (ƏDV), GL-проводка начисления финансового дохода, активация `DRAFT → ACTIVE`, страховка, изъятие, запрос выкупа из кабинета клиента |
| **Ломбарды** | Только универсальный реестр залогов `CollateralItem` + связь с кредитом, касса, начисление процентов/пени | Залоговый билет (girov bileti), оценка золота по пробе и весу, тарифы хранения, фотофиксация, торги по невыкупу, CRUD/переоценка залога в UI |

Правила реализации (как в [02-remediation-backlog.md](./02-remediation-backlog.md)):

- Оценка трудоёмкости: **S** ≤ 3 дня · **M** 1–2 недели · **L** 3–6 недель · **XL** > 6 недель (1 разработчик).
- Все изменения денег — **только через `kernel/posting-engine`** (ADR D6): Serializable / `FOR UPDATE`, идемпотентность, баланс Дт = Кт. Суммы остаются `bigint` (`mulRateRound`), без `Number(amount)`.
- Каждая закрытая задача в том же PR обновляет строку в `Bank-Capability-Inventory.md` и, если меняется sell/show, близкие матрицы готовности. Лизинг / MFI остаются **SCREEN**, пока нет UAT и полевого пилота. Не поднимать `pilot_ready` и не заявлять GA.
- Юридическая интерпретация налогообложения лизинга и формы залогового билета — **[U] юрист** (не выдумывать ставки и бланки сверх явно указанного ниже).

---

## 1. Лизинг

Текущее состояние (`PARTIAL`, UI `/leasing` и ДБО `/leasing` — **SCREEN**, не SHOW): есть `InstitutionType.LEASING_COMPANY` (только `LOAN_LEASE` и `CURRENT`), модели `LeaseAsset` / `LeaseContract` (аванс, остаточная стоимость, связь с `LoanContract`), расчёт графика `buildFinanceLeaseSchedule`, `buyoutQuote`, `accrueFinanceIncome` (только регистр, без GL). Доказательства: `era-bank-core/apps/api/src/modules/leasing/leasing.service.ts`, `lease-ifrs16.util.ts`, `leasing.controller.ts`, `era-bank/app/leasing/page.tsx`, `era-bank-dbo/app/(customer)/leasing/page.tsx`, `__tests__/lease-ifrs16.spec.ts`, `leasing-mvp.spec.ts`.

### P0 — блокеры корректности и продажи лизинга

**P0-L1. Активация договора `DRAFT → ACTIVE` (путь originate / disburse)** · S  
- Файлы: `leasing.service.ts` (`originateLease` создаёт статус `DRAFT`; `accrueFinanceIncome` требует `ACTIVE` и прямо говорит «DRAFT→ACTIVE requires originate/disburse path, not accrual»), `leasing.controller.ts`, `era-bank/app/leasing/page.tsx`, при необходимости `LoansService.disburse`.  
- Что сделать: явный эндпоинт `POST /leasing/contracts/:id/activate` (или `/disburse`): проверка `AVAILABLE→LEASED` уже есть; перевести договор в `ACTIVE` только вместе с выдачей связанного `LOAN_LEASE` через posting engine (дебет лизингового актива / net investment, кредит расчётного счёта клиента или кассы). Идемпотентный ключ `lease-activate-${id}`. Запретить активацию без `loanContractId`, если `linkLoan !== false`. Нельзя переводить статус «в лоб» апдейтом поля.  
- AC / тесты: новый `leasing-activate.spec.ts` — `DRAFT` без выдачи не начисляет доход (уже есть защита); после `activate` статус `ACTIVE`, есть сбалансированная проводка, повторный вызов идемпотентен; `accrueFinanceIncome` после активации проходит; попытка активировать чужой `bankOrgId` — 404.

**P0-L2. GL-проводка ежедневного начисления финансового дохода** · S–M  
- Файлы: `leasing.service.ts` (`accrueFinanceIncome`, комментарий «GL post deferred (INTEREST_INCOME)»), `system-gl-config.service.ts` (ключ `INTEREST_INCOME` уже есть; при необходимости отдельный `LEASE_FINANCE_INCOME` / `LEASE_NET_INVESTMENT`), `eod.service.ts` (подключить шаг EOD), `seed.ts`.  
- Что сделать: начисление за UTC/Baku-день идёт **в одной** Serializable-транзакции с `FOR UPDATE` строки договора (сейчас проверка `lastFinanceAccrualDate` и `update` не атомарны — гонка за день). Проводка: Дт net investment / наращенный доход, Кт `INTEREST_INCOME` (или выделенный ключ). Пропущенные дни: либо явный отказ, либо доначисление числом дней — зафиксировать в AC и в UI как lab-ограничение, если выбран «один день».  
- AC / тесты: расширить `lease-ifrs16.spec.ts` / новый `leasing-accrual-gl.spec.ts` — два параллельных POST за один день дают одну проводку и один прирост регистра; сумма регистра = сумма проводок; без `ACTIVE` — 400; в trial balance Дт = Кт.

**P0-L3. НДС (ƏDV) 18 % в графике вместо `vatMinor = 0n`** · M  
- Файлы: `lease-ifrs16.util.ts` (`vatMinor: 0n` зашит в цикле графика), `leasing.shape.ts`, `leasing.service.ts` (`getSchedule`), seed / `SystemGlKey` для НДС к уплате, ops UI и ДБО (колонка НДС уже есть в типе `ScheduleLine`).  
- Что сделать: ставка НДС — параметр продукта/организации (по умолчанию **18 %**, не константа в формулах), расчёт `vatMinor` от процентной и/или лизинговой платы по правилу, согласованному с юристом (**[U]**: что именно является базой ƏDV по НК АР — не выдумывать молча; до заключения юриста держать `methodology=lab` и явный флаг в API). Проводки начисления/оплаты НДС — только через posting engine. Не сертифицировать IFRS 16 этим шагом.  
- AC / тесты: в `lease-ifrs16.spec.ts` график на известных цифрах даёт ненулевой `vatMinor`, сумма платежей = тело + проценты + НДС; ставка 0 допустима как явный параметр (экспорт и т. п.); UI `/leasing` и ДБО показывают НДС; Inventory `CAP-LN-LEASE` остаётся **PARTIAL**, в примечании — «ƏDV lab, не налоговый модуль».

### P1 — страхование, изъятие, выкуп

**P1-L1. Страхование предмета лизинга** · M  
- Файлы: в лизинговом модуле учёта полиса нет (в банке есть общий `InsurancePolicyLink` / `InsuranceProduct` — bancassurance, не предмет лизинга). Нужны модель/поля на `LeaseAsset` или отдельная `LeaseInsurance`, сервис, UI `/leasing`.  
- Что сделать: полис (номер, страховщик, период, сумма покрытия, валюта), контроль просрочки страховки, уведомление в ops (и позже запрос из ДБО — см. P1-D3). Не обещать интеграцию со страховой компанией.  
- AC / тесты: нельзя активировать договор без действующего полиса, если в шаблоне продукта `insuranceRequired=true`; просроченный полис виден в портфеле; CRUD покрыт тестом сервиса.

**P1-L2. Изъятие / возврат техники (repossession)** · M  
- Файлы: `LeaseAssetStatus`, `leasing.service.ts`, `era-bank/app/leasing/page.tsx`. Сейчас статус актива `AVAILABLE` / `LEASED` (и, если есть в enum, иные значения — не использовать без кода перехода).  
- Что сделать: явный переход `LEASED → REPOSSESSED` / `RETURNED` / снова `AVAILABLE` с проверкой остатка договора, аудиторской записью и (если есть невыкупленный остаток) постановкой связанного займа на взыскание / NPL. Проводки списания/возврата актива — через posting engine.  
- AC / тесты: изъятие `ACTIVE`-договора меняет статус актива, повторное изъятие идемпотентно или 409; `AVAILABLE` актив нельзя изъять; есть тест негативного пути.

**P1-L3. Запрос выкупа (buyout request) в ops и подготовка API для ДБО** · S–M  
- Файлы: `buyoutQuote` уже считает `residual + remaining principal` (`lease-ifrs16.util.ts`); в ДБО кнопки выкупа нет (`era-bank-dbo/doc/OPEN-TASKS.md`).  
- Что сделать: `POST /leasing/contracts/:id/buyout` (черновик запроса → maker-checker → проводка погашения остатка + выкупной стоимости). ДБО-кнопка — в P1-D3, но контракт API заложить здесь.  
- AC / тесты: котировка совпадает с `buyoutQuote`; оплата закрывает договор и освобождает актив; повтор с тем же idempotency key не двойной платеж.

### P2 — глубина, не блокирующая демо

**P2-L1. Сертификация IFRS 16 / полный налоговый контур лизингодателя** · XL — не начинать, пока P0-L1…L3 не закрыты; оставить `methodology=lab`, `notCertified: true`.  
**P2-L2. Отдельный план счетов и бандл `banking_bundle_leasing`** — follow-up к уже частично сделанному P0-2 из [02-remediation-backlog.md](./02-remediation-backlog.md).

---

## 2. Ломбардный модуль

Специализированного модуля **нет**. Поиск по `era-bank-core` / `era-bank` / `era-bank-dbo` — 0 совпадений `pawn` / `lombard` / `gold` / `jewelry` / `bilet`. Есть только универсальный залог: `CollateralItem` + `LoanCollateralLink` (тип строкой, оценка, haircut, доля, `registry`, `encumbranceRef`, `insuredUntil`), API создания/привязки/переоценки и флаг устаревшей оценки. Экран `/risk/collateral` — **только чтение**. Модели `CollateralValuation` и `LienRegister` есть в `schema.prisma` и **не используются** в сервисах и UI. Доказательства: `collateral.service.ts`, `collateral-link.util.ts`, `era-bank/app/risk/collateral/page.tsx`, `LoanModals.tsx`, `__tests__/collateral-attach.spec.ts`.

### P0 — минимальный продаваемый контур ломбарда

**P0-P1. Залоговый билет (girov bileti) и жизненный цикл ломбардного займа** · L  
- Файлы: новая область `era-bank-core/apps/api/src/modules/pawn/` (или расширение `loans` + отдельный kind), Prisma-модели, ops UI (например `/pawn` или вкладка в `/loans`).  
- Что сделать: сущность билета (номер, филиал, клиент CIF, дата выдачи, срок выкупа, льготный период до реализации, статус `ISSUED / ACTIVE / REDEEMED / EXPIRED / IN_AUCTION / SOLD / CANCELLED`), связь 1:1 или 1:N с `LoanContract` (короткий заём под залог) и составом предметов. Печатная форма билета (AZ/RU) — черновик, макет **[U]** юрист / регуляторика ломбардов АР. Выдача и выкуп — проводки через posting engine и кассу (`banking_cash`).  
- AC / тесты: `pawn-ticket.spec.ts` — создание билета выдаёт заём и резервирует предметы; выкуп закрывает заём и освобождает предметы; повторная выдача того же предмета в статусе `PLEDGED` — 400; уникальность номера в рамках `bankOrgId`.

**P0-P2. Оценка золота и изделий: проба, вес, чистота** · M  
- Файлы: расширение `CollateralItem` или дочерняя `PawnItemSpec` (проба `assay` / karat, вес брутто и чистый, единица, вид `GOLD | JEWELRY | WATCH | VEHICLE | OTHER`, опционально камни). Справочник цен на грамм (курс металла на дату, источник ручной или DataHub — не выдумывать живой фид).  
- Что сделать: расчёт оценочной стоимости = f(чистый вес, проба, курс, haircut). Курс и haircut — параметры, не константы в коде. Для авто/прочего имущества — ручная оценка с обязательной заметкой оценщика.  
- AC / тесты: известный пример (вес, проба, курс) даёт фиксированную сумму `bigint`; смена курса не переписывает старые билеты без явной переоценки; тест утилит без БД + сервисный тест.

**P0-P3. CRUD и переоценка `CollateralItem` в ops UI** · S–M  
- Файлы: API уже есть (`loans.controller.ts`: `POST /loans/collateral-items`, `POST .../revalue`, `GET` со `staleRevaluation`); UI `era-bank/app/risk/collateral/page.tsx` только рисует гриды. Форма в `LoanModals.tsx` пишет лишь JSON-снимок `collateralRef`.  
- Что сделать: на `/risk/collateral` (или `/pawn/collateral`) — создание, редактирование, переоценка, привязка к займу/билету с долей и haircut, индикатор «оценка устарела». Подключить уже существующие `CollateralValuation` (история) и, если нужен реестр обременений, начать использовать `LienRegister` либо явно пометить его OUT.  
- AC / тесты: UI-контракт / BFF-прокси уже на `LOANS_*`; сервисные тесты дополнить историей переоценок; ручной UAT SCREEN → не поднимать SHOW без полевого пилота.

### P1 — хранение, фото, реализация невыкупа

**P1-P1. Тарифы хранения** · M  
- Что сделать: тариф (в день / в неделю, по типу предмета или по месту хранения), начисление в EOD через posting engine, отражение в сумме к выкупу. Не путать с арендой банковских сейфовых ячеек (`SafeDepositBox`) — это другой продукт.  
- AC / тесты: день без выкупа увеличивает начисление один раз; выкуп включает накопленное хранение.

**P1-P2. Фотофиксация предмета** · M  
- Что сделать: несколько фото на предмет (загрузка через существующий платформенный файл/DMS-контур, не строки-URL как единственный SoR), обязательность фото при выдаче билета (флаг продукта).  
- AC / тесты: билет без обязательного фото не переводится в `ISSUED`; удаление файла не ломает карточку (мягкая ошибка).

**P1-P3. Реализация / аукцион невыкупленных предметов** · L  
- Что сделать: после льготного срока — статус `IN_AUCTION` / лот (стартовая цена, дата, результат `SOLD` / `UNSOLD`), проводка выручки, закрытие остатка займа, избыток/недостача по правилам **[U]** юрист.  
- AC / тесты: нельзя выставить на торги непросроченный билет; продажа закрывает заём и освобождает или списывает предмет; идемпотентность расчёта.

### P2

**P2-P1. Мобильное рабочее место оценщика / кассира ломбарда** — не в этой волне (ДБО — клиентский веб, не касса).  
**P2-P2. Интеграция с пробирным надзором / реестром залогов** — только после правового канона **[U]**.

---

## 3. Пробелы кредитного ядра, критичные для BOKT, лизинга и ломбардов

Ядро в целом сильнее отраслевых контуров: аннуитет / DIFF, day-count, льготные периоды, XIRR APR, заявки с SoD, линии, EOD-начисление процентов **с GL**, досрочка `REDUCE_TERM` / `REDUCE_INSTALLMENT`, касса, МФР. Ниже — дыры, которые нельзя оставлять, если продаём небанковский сегмент.

### P0

**P0-C1. `collectSheet` — одна Serializable-транзакция и полный откат** · M  
- Файлы: `era-bank-core/apps/api/src/modules/mfi/mfi.service.ts` (`collectSheet`: цикл `await this.loans.repay(...)`, каждое погашение — своя проводка; при ошибке статус листа остаётся `OPEN`, но успешные `repay` **не откатываются**; пустой `lines: []` может пометить лист `COLLECTED`; нет `SELECT FOR UPDATE` на OPEN-лист). Тесты: `mfi-group.spec.ts`. UI: `era-bank/app/mfi/page.tsx`.  
- Что сделать: вся ведомость — один `runSerializableMoneyTx`: блокировка листа, все погашения как ноги/побочные эффекты в той же транзакции, `COLLECTED` только если все положительные строки успешны; пустой список — 400, не `COLLECTED`. Параллельный `collect` по одному листу — один победитель.  
- AC / тесты: новый/расширенный тест — вторая строка падает → ни одной проводки, лист `OPEN`, остатки займов прежние; два параллельных collect — один `COLLECTED`, второй конфликт/идемпотентность; пустой `lines` — 400.

**P0-C2. GL-проводка ежедневного начисления пени** · S–M  
- Файлы: `loans.service.ts` (`accruePenalties` увеличивает только `accruedPenaltyMinor`, без posting engine; пеня попадает в GL лишь в момент `repay`, на `interestGl`). EOD уже вызывает `accruePenalties` (`eod.service.ts`). Тест: `loan-penalty-accrual.spec.ts`.  
- Что сделать: как у `accrueDailyInterest` — проводка в той же транзакции, что и регистр (Дт наращенная пеня / Кт доход от пени, отдельные `SystemGlKey`, не смешивать молча с процентами). Идемпотентность по `loanId + businessDate`.  
- AC / тесты: повтор EOD за день не удваивает пеню; сумма регистра = сумма проводок; погашение уменьшает регистр и корректно закрывает ранее начисленную пеню (водопад `PENALTY → INTEREST → PRINCIPAL` сохранить).

### P1

**P1-C1. Реструктуризация с пересчётом графика** · M  
- Файлы: `loans.service.ts` (`restructure` меняет только `ifrs9Stage` и статус `ACTIVE`, пишет аудит, **график не перестраивает**). Перестройка графика уже есть в `rebuildUnpaidScheduleInTx` для `prepay`. UI: вкладка «restructure» в `LoanModals.tsx`.  
- Что сделать: реструктуризация принимает новый срок / ставку / льготу / дату первого платежа, перестраивает **непогашенные** платежи в той же денежной транзакции (без трогания уже `PAID` / `WAIVED`), ставит качественный флаг `RESTRUCTURED` (уже влияет на пруденциальную категорию). SoD: maker ≠ checker.  
- AC / тесты: расширить `loan-schedule.spec.ts` / новый `loan-restructure.spec.ts` — сумма остатка тела после пересчёта равна `outstandingMinor`; оплаченные строки на месте; без SoD — 403.

**P1-C2. Донастройка BOKT-пакета (не новый CBS)** · M  
- Уже сделано (не повторять): гейт депозитов и фильтр шаблонов ЦБА (`institution-type.util.ts`, `institution-product-gate.spec.ts`).  
- Осталось: полный seed плана счетов и entitlement-бандл `banking_bundle_nbco` (follow-up P0-2 бэклога); не обещать живую сдачу CBAR (см. §5).

---

## 4. Пробелы клиентского приложения (ДБО), важные для этих сегментов

`era-bank-dbo` — **веб-портал** (Next.js + Nest BFF), не нативное iOS/Android-приложение. Уже работает в lab: OTP-вход, счета/выписки, внутренние переводы, платёжные поручения (в т. ч. двойная подпись юрлиц), постоянные поручения, заявка на кредит, полный график и APR, досрочка, чтение графика лизинга. ASAN/SİMA live — fail-closed (`completeChallenge` → `ConfigError`). Уведомлений push/SMS/email о просрочке нет.

### P1

**P1-D1. Оплата очередного взноса с карты / через терминал (шлюз, не «кнопка в пустоту»)** · L + внешний партнёр  
- Сейчас нет кнопки «оплатить очередной платёж по графику» и нет приёма через MilliÖn / eManat / карточный эквайринг (`MockAzeriCardGateway` — только эмитентский контур lab).  
- Что сделать **внутри продукта** (без фейкового live): сценарий «оплатить ближайший `DUE` / `OVERDUE` взнос» с внутреннего счёта клиента (это можно закрыть на текущем `repay` + UI в `/loans`); отдельный адаптер входящих платежей терминала/эквайринга — за интерфейсом, по умолчанию stub, live только при ключах партнёра (как `BANK_BUREAU_MODE`).  
- AC / тесты: оплата взноса со счёта уменьшает график как `repay`; адаптер терминала в stub помечает `LAB_ONLY_NOT_LIVE`; без ключей `live` — ConfigError, не «успех».

**P1-D2. Уведомления о платеже и просрочке (outbox + хотя бы один канал)** · M  
- Файлы: в ДБО поиска `notif|push|sms` по смыслу клиентских алертов нет; платформенный outbox вебхуков в ядре есть (`WebhookDeliveryOutbox`).  
- Что сделать: событие «D-3 до платежа», «платёж просрочен», «ведомость сбора закрыта» — в outbox; канал lab = запись в inbox / email-заглушка; SMS/push — за адаптером, не обещать оператора.  
- AC / тесты: EOD создаёт одно событие на просроченный заём; повтор EOD не дублирует; в UI ДБО виден список уведомлений (минимальный inbox).

**P1-D3. Запрос выкупа и уведомление о страховке лизинга в ДБО** · S–M (после P1-L1 / P1-L3)  
- Файлы: `era-bank-dbo/app/(customer)/leasing/page.tsx`, `era-bank-dbo/nest/generated/leasing_contracts*.ts`, `era-bank-dbo/doc/OPEN-TASKS.md`.  
- AC / тесты: клиент видит котировку, отправляет запрос, статус виден; без BFF не считать задачу закрытой.

**P1-D4. Кабинет группового заёмщика BOKT** · M  
- Сейчас полевой UI сбора — только ops `/mfi`. В ДБО нет экрана группы, солидарной ответственности и своей строки ведомости.  
- AC / тесты: заёмщик видит свою группу (без чужих сумм сверх своей доли / правил продукта), свою задолженность и факт сбора; лидер — только если роль `LEADER`; изоляция `bankOrgId` + `customerId`.

### P2

**P2-D1. Нативное мобильное приложение** — отдельная программа, не часть этого ADR.  
**P2-D2. Живой Open Banking ЦБА / TPP** — см. §5, не продавать как готовое.

---

## 5. Внешние интеграции (заглушки): что есть и что нужно, чтобы стало live

Не реализовывать «успешный live» без ключей и песочницы партнёра. Паттерн уже принят: `BANK_*_MODE=live` → fail-closed, если нет URL/ключа; stub не выдавать за боевой успех.

| Интеграция | Сейчас | Что нужно для live | Inventory / гейт |
|------------|--------|--------------------|------------------|
| **АКБ (кредитное бюро)** | `StubCreditBureauAdapter` по умолчанию; `LiveAkbAdapter` за `BANK_BUREAU_MODE=live` + `BANK_AKB_BASE_URL` / `BANK_AKB_API_KEY` | Договор с АКБ, песочница, согласие субъекта, UAT сверки балла и кредитной истории | `CAP-LN-AKB` DECLARED, YC-E4 |
| **ЦКР / CKR (Центральный кредитный реестр)** | Очередь `CreditDebtStatusQueueItem`, журнал `CreditRegistrySubmitJournal`, `submitPendingStubBatch` с `submittedLive: false`, `STUB_CKR_LAB` | Спецификация файла/API ЦБА, стенд, fail-closed без учётки, разбор ошибок реестра | то же YC-E4 |
| **ASAN İmza / SİMA** | `StubAsanSimaAdapter`; в `live` `completeChallenge` бросает `ConfigError` (YC-E3) — так и должно остаться, пока нет callback | Договор ASAN/SİMA, `BANK_ASAN_BASE_URL` / API key, подпись callback, не фейкать verified | `CAP-DBO-ASAN` DECLARED |
| **AZIPS / XÖHKS / AÖS / SWIFT** | Фабрика адаптеров есть, отправка через `rail-stub.submit.ts` / `LAB_ONLY_NOT_LIVE_RAIL` | Доступ к рельсам ЦБА / корреспонденту, ISO 20022, сертификаты, сверка выписок | `CAP-PAY-RAIL` DECLARED, YC-E1 |
| **AzeriCard / MilliKart** | `MockAzeriCardGateway` | Процессинговый договор, testbench auth/clearing/3DS | `CAP-CARD-LIVE` DECLARED, YC-E2 |
| **MilliÖn / eManat / входящие терминалы** | **Нет адаптера** | Партнёр, протокол сверки, идемпотентность платежей в `repay` | завести DECLARED при появлении модуля |
| **CBAR / FMN сдача отчётности** | Сборка lab JSON/CSV, пакет BOKT, контрольные соотношения; `labExportOnly`; FMN `schemaVersion = "FMN-TEST-1"`; санкции — seed-файл | Официальные XSD **[U]**, шлюз ЦБА / СФМ, живой санкционный feed | `CAP-REG-CBAR`, `CAP-AML-FMN` DECLARED; feed BLOCKED |
| **ƏMDK / реестр имущества** | Только текстовые поля `registry` / `encumbranceRef` | Если понадобится ломбардам и автозалогу — отдельный адаптер, не парсинг строки | `CAP-LN-EMDK` DECLARED |
| **Open Banking ЦБА (Manual v1.3)** | Согласие ≤ 90 дней + обязательный `scaChallengeId` (любая непустая строка), нет шлюза ЦБА / TPP | Песочница ЦБА, регистрация TPP, боевой SCA | `CAP-DBO-OB` PARTIAL |

---

## 6. Порядок внедрения (рекомендуемый)

1. **P0-C1, P0-C2, P0-L1, P0-L2** — денежная корректность (ведомость, пеня, активация лизинга, GL дохода). Без этого нельзя честно показывать EOD и лизинг.  
2. **P0-L3, P0-P3, P1-C1** — ƏDV lab, UI залогов, реструктуризация графика.  
3. **P0-P1, P0-P2** — собственно ломбардный билет и оценка золота (отдельный модуль, не маскировать под обычный кредит).  
4. **P1 лизинг / ломбард / ДБО** — страховка, изъятие, выкуп, хранение, фото, торги, уведомления, кабинет группы.  
5. **Внешние live** — только по мере появления песочниц; до этого не менять Inventory с DECLARED/BLOCKED на IN.

Не смешивать в одном PR «новый ломбард» и «живые рельсы».

---

## 7. Промпт для Cursor (вставить как есть)

```
Контекст: ERA Bank (era-bank-core + era-bank + era-bank-dbo) — edition mvp, pilot_ready: false.
Канон: docs/adr/bank/bank-leasing-pawnshop-gaps-2026-11-26.md (этот план), docs/adr/bank/02-remediation-backlog.md, docs/adr/bank/03-external-blockers.md, docs/acceptance/Bank-Capability-Inventory.md, docs/editions/bank.yaml.
Правила: деньги только через kernel/posting-engine (ADR D6, Serializable / FOR UPDATE, идемпотентность, bigint / mulRateRound, без Number(amount)). Не запускать Docker, не трогать PATH и D:\nodejs22, не поднимать pilot_ready / GA, не выдавать stub-интеграции за live. В том же PR обновляй строку Inventory (CAP-LN-LEASE / новый pawn / CAP-LN-MFI остаются PARTIAL/SCREEN, пока нет UAT). Юридические ставки и бланки сверх явно указанного — не выдумывать ([U] юрист).

Сначала закрой денежные P0 и не смешивай их с новым ломбардным модулем в одном PR:

1) P0-C1 collectSheet: одна Serializable-транзакция на всю ведомость; при ошибке любой строки откатить все repay; пустой lines → 400, не COLLECTED; блокировка OPEN-листа. Файл: era-bank-core/apps/api/src/modules/mfi/mfi.service.ts. Тесты: ошибка второй строки не оставляет проводок; параллельный collect — один победитель.

2) P0-C2 пеня: accruePenalties постит GL в той же транзакции, что регистр (отдельный SystemGlKey, идемпотентность по займу+дате). Файл: loans.service.ts, eod.service.ts. Тест: повтор EOD не удваивает пеню.

3) P0-L1 лизинг: POST /leasing/contracts/:id/activate переводит DRAFT→ACTIVE только вместе с выдачей связанного LOAN_LEASE через posting engine; без «голого» апдейта статуса. accrueFinanceIncome по-прежнему только для ACTIVE. Тест: идемпотентная активация, 404 чужого org, начисление до активации — 400.

4) P0-L2: accrueFinanceIncome делает GL-проводку; проверка lastFinanceAccrualDate и update в одной tx с FOR UPDATE строки договора. Тест: два параллельных начисления за день → одна проводка.

5) P0-L3: ƏDV в графике лизинга (ставка параметром, дефолт 18%), не vatMinor=0n; methodology=lab, не налоговый модуль. Тесты в lease-ifrs16.spec.ts; колонка НДС в /leasing и ДБО.

6) P0-P3: CRUD и переоценка CollateralItem в era-bank/app/risk/collateral (API уже есть: collateral.service.ts / loans.controller.ts). Подключи историю CollateralValuation. LienRegister не оставляй мёртвой моделью без решения.

7) P1-C1: restructure должен перестраивать непогашенный график (переиспользовать rebuildUnpaidScheduleInTx), ставить quality flag RESTRUCTURED, SoD maker≠checker — не только ifrs9Stage.

Дальше отдельными PR, по плану в том же ADR: ломбардный билет (girov bileti) + оценка золота (проба/вес/курс/haircut) + тарифы хранения + фото + аукцион невыкупа; лизинг — страховка предмета, изъятие, buyout request; ДБО — оплата очередного взноса со счёта, inbox уведомлений, кабинет группового заёмщика BOKT, запрос выкупа/страховки лизинга. Карты/терминалы/MilliÖn, АКБ, ЦКР, ASAN/SİMA, AZIPS/XÖHKS/AÖS/SWIFT, CBAR XSD — только адаптер + fail-closed live, без фейкового успеха.

Не реализуй нативное мобильное приложение в этих PR. После каждого PR: тесты, typecheck где уместно, честное примечание в Inventory, лизинг/ломбард/MFI не переводить в SHOW без UAT.
```

---

## 8. Источники (сверка 26.11.2026)

- `era-bank-core/apps/api/src/modules/leasing/leasing.service.ts`, `lease-ifrs16.util.ts`, `leasing.controller.ts`
- `era-bank-core/apps/api/src/modules/loans/loans.service.ts`, `loan-repay.util.ts`, `loan-schedule.util.ts`, `collateral.service.ts`, `bureau.adapter.ts`
- `era-bank-core/apps/api/src/modules/mfi/mfi.service.ts`
- `era-bank-core/apps/api/src/kernel/eod/eod.service.ts`, `kernel/ledger/system-gl-config.service.ts`, `kernel/posting-engine/`
- `era-bank-core/apps/api/src/common/institution-type.util.ts`
- `era-bank-core/packages/database/prisma/schema.prisma`, `seed.ts`
- `era-bank/app/leasing/page.tsx`, `app/mfi/page.tsx`, `app/risk/collateral/page.tsx`, `src/components/ops/modals/LoanModals.tsx`
- `era-bank-dbo/app/(customer)/loans/page.tsx`, `loans/apply/page.tsx`, `leasing/page.tsx`, `doc/OPEN-TASKS.md`
- `era-bank-core/apps/api/src/integration/asan-sima.adapter.ts`, `modules/payments/rail-stub.submit.ts`, `modules/cards/gateway/mock-azericard.gateway.ts`
- Тесты: `lease-ifrs16.spec.ts`, `leasing-mvp.spec.ts`, `loan-repay.spec.ts`, `loan-penalty-accrual.spec.ts`, `mfi-group.spec.ts`, `collateral-attach.spec.ts`, `institution-product-gate.spec.ts`
