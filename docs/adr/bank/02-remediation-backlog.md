# ERA Bank — Remediation backlog (§§9–11)

> Split from [bank-satellite-gap-analysis.md](../bank-satellite-gap-analysis.md).
> Status: living backlog (code HAS changed since the original 2026-11-25 01:01 snapshot). See also [BANK-AUDIT-2026-11-25.md](../BANK-AUDIT-2026-11-25.md).

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
