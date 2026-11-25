# Аудит v3 — повторная проверка банка (только код)

**Дата аудита:** 25.11.2026, 03:48 (Asia/Baku, UTC+4)  
**Аудитор:** Мика (только чтение; в проект добавлен лишь этот отчёт)  
**Эталон:** `docs/adr/BANK-AUDIT-2026-11-25-v2.md` (25.11.2026 02:39, 18 082 байт)  
**Объект:** рабочее дерево `era-bank-core` / `era-bank` / `era-bank-dbo`  
**Тесты, typecheck, git, UAT и DoD:** не запускались и не оценивались (по договорённости с Чингизом).

Обозначения относительно v2: **исправлено** · **частично / ещё открыто** · **не исправлено** · **новая регрессия**.

---

## 0. Что изменилось с аудита v2 (02:39 → 03:48)

Слой движка заметно дописан, живых интеграций по-прежнему нет.

- **Конкуренция / проводки.** Opt-in DB-тест больше не обращается к несуществующей модели `bankOrganization`: резолв идёт через `bankInstitutionConfig` / `branch` (`era-bank-core/apps/api/__tests__/posting-concurrency.spec.ts`). Гонка одинаковых idempotency-ключей теперь ловится: после P2002 вызывается `findByIdempotencyKey` и возвращается победитель (`posting-engine.service.ts`, `isUniqueViolation`). Появились `lockNostroAccountsForUpdate`. Тест по-прежнему **opt-in** (`BANK_CONCURRENCY_DB_TEST=1`) и гоняет хелперы `runSerializableMoneyTx` / `lockAccountsForUpdate`, а не `PostingEngineService.post`.
- **Списание ümidsiz.** Появились `umidsiz-write-off.util.ts`, `writeOffUmidsizLoan` в `prudential-provisioning.service.ts`, маршрут `POST prudential/loans/:loanId/write-off` (зарегистрирован до `:id`), UI `/risk/prudential`, тест `umidsiz-write-off.spec.ts`. Проводка идёт через posting engine, статус займа и график меняются в `sideEffectsInTx`.
- **Институциональные гейты.** Расширен `institution-type.util.ts`: БОКТ без розничных депозитов; лизинговая компания — только `LOAN_LEASE` + `CURRENT`; кредитный союз — без карт / trade / syndicated / lease / islamic.
- **Лизинг.** Lab-график МСФО 16, котировка выкупа, ежедневное начисление финансового дохода: `lease-ifrs16.util.ts`, эндпоинты `schedule` / `buyout-quote` / `accrue-finance-income`, ops UI и попытка графика в ДБО.
- **БКО / групповые займы (MFI).** Collection sheet (создание / collect), `officerId`, `par30ByOfficer`, ops UI.
- **ECL (lab).** Lifetime PD, CCF, макро-веса, SICR, `discountEclLab` (годовой коэффициент-заглушка).
- **Webhooks.** Появились таблица `webhook_delivery_outbox`, `enqueueOutbox` / `drainOutbox`, backoff.
- **Open Banking.** Кроме лимита 90 дней требуется `scaChallengeId` — любая непустая строка, без шлюза ЦБА и без проверки OTP/ASAN.
- **Санкции.** Seed увеличен (`sanctions-seed-v2-LAB-NOT-LIVE`, файл ~2706 байт), живого ingest нет.
- **Рельсы / карты / CKR / FMN.** Существенных сдвигов к live нет.

Миграция `20261125200000_waves_2_4_lab` существует и по полям совпадает со схемой (см. §4).

---

## 1. Сводка по 24 пунктам P0–P2

Сравнение со статусами v2 (сделано 2 / частично 20 / не сделано 2). **Счётчик тот же:** глубина многих «частично» выросла, но ни один пункт не дошёл до полного AC исходного gap-анализа, и боевые рельсы/карты по-прежнему не сделаны.

| Статус | Кол-во | Комментарий |
|---|---|---|
| Сделано | **2** | без изменений (P2-1, P2-9) |
| Частично | **20** | глубже: P0-1, P0-2, P0-3, P0-4, P1-1/2, P1-5, P1-6, P2-2, P2-6 |
| Не сделано | **2** | P1-4 (боевые рельсы) и P2-8 (боевые карты) |

---

## 2. Пункты v2 и явные проблемы — статус с доказательствами

### 2.1. Явные проблемы, которые просил перепроверить

| Проблема v2 | Статус v3 | Доказательство |
|---|---|---|
| Concurrency-тест ссылается на несуществующую `bankOrganization` | **исправлено** | `__tests__/posting-concurrency.spec.ts`: `prisma.bankInstitutionConfig.findFirst`, `prisma.branch.findFirst`; комментарий «no BankOrganization model». Остаточный риск: тест opt-in и не вызывает `PostingEngineService.post`. |
| Нет списания ümidsiz | **исправлено** (с оговорками в §3) | `umidsiz-write-off.util.ts`; `prudential-provisioning.service.ts` (`writeOffUmidsizLoan`); `risk.controller.ts` `POST prudential/loans/:loanId/write-off`; UI `era-bank/app/risk/prudential/page.tsx`; `__tests__/umidsiz-write-off.spec.ts`. Проводка через engine, SoD checker ≠ maker, `sideEffectsInTx` ставит `WRITTEN_OFF` / outstanding 0 / WAIVED. |
| Санкционный список только seed | **ещё открыто** | `aml.service.ts`: `import sanctionsSeed from "./sanctions-seed.json"`, `SANCTIONS_LAB_LIST_VERSION = "sanctions-seed-v2-LAB-NOT-LIVE"`. Живого ingest OFAC/EU/UN нет. |
| Заглушки платёжных рельсов (AZIPS/XÖHKS/AÖS/SWIFT) | **не исправлено** | `azips.adapter.ts`, `xohks.adapter.ts`, `aos.adapter.ts`, `swift.adapter.ts` все зовут `submitExternalRailStub` (`rail-stub.submit.ts`): `accepted: true`, `simulatedAck: true`, `warning: "LAB_ONLY_NOT_LIVE_RAIL"`. Live-режим по-прежнему fail-closed (ConfigError), отдельного боевого адаптера нет. |
| Карточный процессинг | **не исправлено** | `cards.module.ts` / `cards.service.ts` — только `MockAzeriCardGateway`. |
| Open Banking против стандарта ЦБА (Manual v1.3) | **ещё открыто** | Лимит 90 дней есть (`OPEN_BANKING_CONSENT_MAX_DAYS`). `validateOpenBankingScaChallengeId` принимает **любую непустую** строку и сразу создаёт согласие `ACTIVE` (`dbo-ops.service.ts`). Нет шлюза ЦБА, нет формы AIS/PIS по мануалу, нет TPP JWT. |
| Лизинг, БКО, групповые займы | **частично** | Лизинг: график/выкуп/accrue (lab). MFI: collection sheets, officer, PAR30, JLG. БОКТ/лизинг/кредитный союз — гейты в `institution-type.util.ts`. До live-учёта и полевого контура далеко (баги §3). |
| Фичи кредитного движка | **частично** | Досрочка/идемпотентность/водопад/атомарность — как в v2. Календарь рабочих дней по-прежнему только сб/вс (`loan-date.util.ts`: «Skip Sat/Sun (lab)»). `loan-schedule.util.ts` всё ещё считает проценты через `Number(remaining) * periodRate`. |
| Провизии ЦБА, кредитный регистр/бюро, ФМС (СФМ) | **частично** | Провизии: классификация + списание ümidsiz появились. CKR: `StubCreditRegistryAdapter`, `provider: "STUB_CKR_LAB"`, `submittedLive: false`; live за флагом. Очередь `creditDebtStatusQueueItem` + журнал `CreditRegistrySubmitJournal`. FMN: `schemaVersion = "FMN-TEST-1"`, календарь подачи — только weekend skip (`addBusinessDaysSync`). |

### 2.2. Остальные P0–P2

- **P0-1** частично — изоляция в engine, treasury через post, P2002 обрабатывается, nostro lock есть; алмазный DB-тест не гоняет сам `post()`.
- **P0-2** частично — гейты типов учреждений расширены; отдельных «бандлов» издания под лицензию по-прежнему нет.
- **P0-3** частично — write-off закрыл главный пробел v2; официальных форм ЦБА и автосписания в EOD нет. SoD ослаблен, если maker классификации = `risk-system` (см. §3).
- **P0-4** частично — см. кредитный движок выше.
- **P0-5** частично — без живой подачи и официальных форм регулятора.
- **P0-6** частично — seed шире, ingest нет, FMN-TEST-1.
- **P1-1 / P1-2** частично — UI и lab-контур лизинга/MFI появились; GL по finance income отложен; collection sheet неатомарен.
- **P1-3** частично — stub больше не маскируется под live (как в v2); боевой CKR/АКБ нет.
- **P1-4** **не сделано**.
- **P1-5** частично — 90 дней + lab SCA-строка; стандарта ЦБА нет.
- **P1-6** частично — lab lifetime/CCF/макро/SICR/дисконт добавлены; дисконт — «one-year factor», CCF через `Number(undrawnMinor) * ccf`.
- **P1-7** частично — WHT по-прежнему через bigint (`deposit-interest-wht.util.ts`), без изменений к худшему.
- **P1-8** частично — `startChallenge` ждёт HTTP (v2); `completeChallenge` в live бросает ConfigError.
- **P1-9** частично — связи залогов в ECL, как в v2.
- **P2-1** сделано (оговорка про lab-строки Inventory сохраняется; в этом проходе документы почти не разбирались).
- **P2-2** частично — **прогресс:** durable outbox (`WebhookDeliveryOutbox`, миграция waves_2_4_lab, `drainOutbox`). Это уже не только in-memory retries. Боевого воркера/гарантированного drain в EOD по коду маршрутов не видно как обязательного процесса; `BANK_WEBHOOK_DELIVER=0` — dry-run.
- **P2-3…P2-5, P2-7** частично — скаффолды / только контур, без нового боевого содержимого.
- **P2-6** частично — график лизинга в ДБО **задуман**, но BFF-маршрут отсутствует (новая ошибка, §3). Engine: `GET dbo/leasing/contracts/:id/schedule` проверяет `getLease(customerAuth, id)` — изоляция клиента на стороне API есть.
- **P2-8** **не сделано**.
- **P2-9** сделано.

---

## 3. Новые баги и остаточные дефекты в изменённом коде

### Критичные / учётные

1. **`collectSheet` неатомарен и помечает ведомость COLLECTED даже при ошибках погашения.**  
   `mfi.service.ts` (`collectSheet`): цикл `loans.repay(...)` в `try/catch`, затем безусловный `collectionSheet.update({ status: COLLECTED })`. Часть займов может не погаситься, лист всё равно «собран». Повтор после частичного успеха до апдейта статуса может привести к повторным попыткам; ключ идемпотентности `mfi-sheet-${sheetId}-${loanId}-${amount}` привязан к сумме — смена суммы даёт другой ключ и риск двойного погашения.

2. **Начисление финансового дохода лизинга без GL и без защиты от повторного вызова.**  
   `leasing.service.ts` `accrueFinanceIncome`: увеличивает `accruedFinanceIncomeMinor` на `dailyFinanceIncomeMinor(...)`, пишет `lastFinanceAccrualDate`, но **не проверяет**, что за эту дату уже начисляли. Повторный POST за тот же день удваивает регистр. Комментарий честно говорит «GL post deferred (INTEREST_INCOME)» — регистр и главная книга расходятся. Вызов на статусе `DRAFT` ещё и переводит договор в `ACTIVE` без проводки выдачи.

3. **Деньги через `Number()` / `Math.round` в новом и старом lab-коде.**  
   - `lease-ifrs16.util.ts`: `Number(remaining) * monthlyRate`, `Number(netInvestmentMinor) * (rateAnnual / 365)`.  
   - `ecl.engine.ts`: `Number(undrawnMinor) * ccf`, `Number(eclMinor) * factor`, `Number(collateralAmountMinor) / Number(outstandingMinor)`.  
   - `loan-schedule.util.ts` (хвост v1/v2, не исправлен): `Number(remaining) * periodRate`.  
   WHT в депозитах по-прежнему аккуратно на bigint — контраст показывает, что новый код лизинга/ECL отступил от правила.

### Авторизация / SoD / заглушки «как успех»

4. **Write-off: `autoApprove: true` и слабый SoD при системном maker.**  
   Контроллер передаёт только `checkerUserId: req.userId ?? "service"`. Maker берётся из прогона классификации либо `"risk-system"`. SoD (`assertUmidsizWriteOffSoD`) срабатывает, только если maker совпал с checker. Если классификацию сделал EOD/`risk-system`, один пользователь проводит списание в одиночку, а posting engine ещё и обходит свой checker из‑за `autoApprove: true`. Требуется филиал с `code: "HQ"`, иначе `NotFoundException` — жёсткая зависимость от сида, не от реальной ветки договора.

5. **Lab SCA Open Banking — по сути обход SCA.**  
   `validateOpenBankingScaChallengeId` проверяет только `trim()` ≠ пусто. Любая строка (`"x"`) активирует согласие. Это не вызов ASAN/SİMA и не SCA шлюза ЦБА. Для lab допустимо только если клиент и инвентарь явно помечают SCAFFOLD; как «соответствие Manual v1.3» — нет.

6. **Рельсы по-прежнему отвечают `accepted: true`.**  
   Подпись `LAB_ONLY_NOT_LIVE_RAIL` / `STUB-LAB-` честнее, чем в v1, но вызывающий код, который смотрит только на `accepted`, получит успех. Это не регрессия относительно v2, а неснятый риск.

### UI / контракты API

7. **ДБО вызывает несуществующие BFF-эндпоинты лизинга (новая регрессия UX/контракта).**  
   `era-bank-dbo/app/(customer)/leasing/page.tsx` делает `fetch("/api/leasing/contracts")` и `fetch("/api/leasing/contracts/${id}/schedule")`. В `era-bank-dbo/app/api/` каталога `leasing` нет (есть accounts, loans, payments, …). `next.config.ts` рерайтов не содержит. Клиент двигателя прописан в `lib/engine-dbo-client.ts` (`/api/v1/dbo/leasing/contracts/:id/schedule`), но Next-обёртки нет — страница ДБО получит 404.  
   Ops UI (`era-bank/app/leasing`, `/mfi`, `/risk/prudential`) ходит в префиксы, которые есть в `era-bank/nest/engine-proxies.ts` (`leasing`, `mfi`, `risk` + `http.all(/api/${prefix}/*path)`), здесь маршруты сходятся.

### Что проверено и не всплыло как новый дефект

- Прямых `ledgerBalanceMinor: { increment/decrement }` в treasury/loans/leasing/mfi нет (кроме фильтра `not: 0n`).
- Изоляция `bankOrgId` на collection sheets, write-off, leasing `getById`/portfolio — есть. ДБО-график на стороне engine проверяет `getLease` своего клиента (BFF просто не доходит).
- `organizationId` на create часто не пишется явно (`createAsset`, `createCollectionSheet`) — это, скорее всего, закрывает `createSatelliteTenantExtension` в `prisma.service.ts`; отдельного обхода тенанта по коду не видно.
- Сломанных импортов/ссылок на переименованные модули в просмотренных файлах нет (typecheck не запускался).

---

## 4. Миграции и схема (факт, без git)

Новая миграция **есть:** `era-bank-core/packages/database/prisma/migrations/20261125200000_waves_2_4_lab/migration.sql`.

Совпадает со `schema.prisma`:

| Миграция | Схема |
|---|---|
| `lease_contracts.net_investment_minor`, `accrued_finance_income_minor`, `last_finance_accrual_date` | `LeaseContract.netInvestmentMinor`, `accruedFinanceIncomeMinor`, `lastFinanceAccrualDate` |
| `borrower_groups.officer_id` + индекс | `BorrowerGroup.officerId`, `@@index([bankOrgId, officerId])` |
| enum + таблица `collection_sheets` | `model CollectionSheet` |
| `open_banking_consents.sca_challenge_id` | `scaChallengeId` |
| enum + таблица `webhook_delivery_outbox` | `model WebhookDeliveryOutbox` |
| таблица `credit_registry_submit_journal` | `model CreditRegistrySubmitJournal` |

Ранее добавленные миграции волн 25.11 (`…010000` … `…160000`) на месте; расхождений новых полей с Prisma-моделями не видно. Применялись ли они к стендовой БД — вне скоупа этого прохода.

---

## 5. Сноска по документам

Код ушёл вперёд (write-off, collection sheets, IFRS 16 lab, outbox, SCA-поле). Если Inventory/план всё ещё держат `CAP-DBO-OB = IN` или волны как `completed`, это снова завышение относительно фактического lab-контура. Подробный разбор документов в этом аудите не делался.

---

## 6. Источники (код)

- `era-bank-core/apps/api/src/kernel/posting-engine/posting-engine.service.ts`
- `era-bank-core/apps/api/__tests__/posting-concurrency.spec.ts`
- `era-bank-core/apps/api/src/modules/risk/prudential-provisioning.service.ts`, `umidsiz-write-off.util.ts`, `risk.controller.ts`, `ecl.engine.ts`
- `era-bank-core/apps/api/src/modules/leasing/leasing.service.ts`, `lease-ifrs16.util.ts`, `leasing.controller.ts`
- `era-bank-core/apps/api/src/modules/mfi/mfi.service.ts`, `mfi.controller.ts`
- `era-bank-core/apps/api/src/modules/loans/loan-schedule.util.ts`, `loan-date.util.ts`, `credit-registry.adapter.ts`, `credit-registry.service.ts`
- `era-bank-core/apps/api/src/modules/aml/aml.service.ts`, `sanctions-seed.json`, `fmn-report-formatter.ts`
- `era-bank-core/apps/api/src/modules/payments/rail-stub.submit.ts` и адаптеры AZIPS/XÖHKS/AÖS/SWIFT
- `era-bank-core/apps/api/src/modules/cards/*`, `modules/dbo/open-banking-consent.util.ts`, `dbo-ops.service.ts`, `dbo-accounts.controller.ts`
- `era-bank-core/apps/api/src/modules/webhooks/webhooks.service.ts`
- `era-bank-core/packages/database/prisma/schema.prisma`, `migrations/20261125200000_waves_2_4_lab/migration.sql`
- `era-bank/app/leasing/page.tsx`, `app/mfi/page.tsx`, `app/risk/prudential/page.tsx`, `nest/engine-proxies.ts`
- `era-bank-dbo/app/(customer)/leasing/page.tsx`, `lib/engine-dbo-client.ts`, `app/api/` (каталога `leasing` нет)

---

## 7. Remediation closeout (2026-11-25, post-v3)

Code fixes for §3 critical/SoD/contract items. **No Scaffold ✅ / sell / Pilot / `mvp` uplift.** Partner rails/cards stay fail-closed.

| §3 item | Status | Fix |
|---|---|---|
| 1 `collectSheet` COLLECTED on partial fail + amount in idempotency key | **fixed** | `COLLECTED` only if all repay attempts succeed; else stay `OPEN` + `BadRequestException`; key `mfi-sheet-${sheetId}-${loanId}` (no amount) |
| 2 `accrueFinanceIncome` double-day + DRAFT→ACTIVE | **fixed** | ACTIVE-only; same-UTC-day skip (`skipped: true`); no status flip on accrual |
| 3 `Number()` money in lease/ECL/schedule | **fixed (lab paths)** | `money-rate.util.ts` `mulRateRound` / `coverageRatioScaled`; lease-ifrs16, leasing.shape, ecl.engine, loan-schedule, ECL collateral links, capital RWA |
| 4 ümidsiz SoD + `autoApprove` | **fixed** | ban system actors as maker/checker; require authenticated checker; `autoApprove: false`; optional body `makerUserId` |
| 7 DBO leasing BFF 404 | **verified Nest path** | No `app/api/leasing` by design — BFF is Nest `nest/generated/leasing_contracts*.ts` via `npm run front` (`/api` → Nest). Engine `GET dbo/leasing/contracts(+/:id/schedule)` + customer isolation intact |

Still open from v3 (out of this remediation): live rails/cards, OFAC ingest, CBAR OB SCA gateway, official CBAR forms, GL post for lease finance income, opt-in concurrency covering `post()`.
