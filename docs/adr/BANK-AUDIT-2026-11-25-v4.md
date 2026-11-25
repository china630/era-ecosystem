# Аудит v4 — повторная проверка банка (только код)

**Дата аудита:** 25.11.2026, 04:08 (Asia/Baku, UTC+4)  
**Аудитор:** Мика (только чтение; в проект добавлен лишь этот отчёт)  
**Эталон:** `docs/adr/BANK-AUDIT-2026-11-25-v3.md` (25.11.2026 03:50, 20 850 байт)  
**Объект:** файлы `era-bank-core` / `era-bank` / `era-bank-dbo`, изменённые после 03:50  
**Тесты, typecheck, git, UAT и DoD:** не запускались и не оценивались.

Обозначения относительно v3: **исправлено** · **частично / ещё открыто** · **не исправлено** · **новая регрессия**.

---

## 0. Что изменилось с аудита v3 (03:50 → 04:08)

После v3 правили в основном контур рисков, лизинга, MFI и денег (03:54–03:57). ДБО, рельсы, карты, AML/FMN, CKR и Open Banking **не трогались**. Новых миграций нет.

Изменённые файлы:

- новый `era-bank-core/apps/api/src/common/money-rate.util.ts` + `__tests__/money-rate.spec.ts` — `mulRateRound` / `coverageRatioScaled` (сумма остаётся bigint, ставка масштабируется);
- `lease-ifrs16.util.ts`, `loan-schedule.util.ts`, `ecl.engine.ts`, `leasing.shape.ts`, `capital.service.ts`, `risk.service.ts` — суммы переведены на `mulRateRound`;
- `mfi.service.ts` — логика `collectSheet`;
- `leasing.service.ts` — защита `accrueFinanceIncome`;
- `umidsiz-write-off.util.ts`, `prudential-provisioning.service.ts`, `risk.controller.ts`, `__tests__/umidsiz-write-off.spec.ts`, ops UI `era-bank/app/risk/prudential/page.tsx` (+ строки в `messages/*`).

---

## 1. Сводка P0–P2

Счётчик **как в v3:** сделано **2** (P2-1, P2-9) / частично **20** / не сделано **2** (P1-4 боевые рельсы, P2-8 боевые карты).

Закрыты конкретные дефекты v3 в collectSheet, графике/ECL/лизинге и SoD списания; глубина P0-3, P1-1/2, P1-6 выросла. P2-6 по-прежнему упирается в отсутствующий BFF лизинга в ДБО. Живых интеграций нет.

---

## 2. Баги v3 — статус с доказательствами

| Баг v3 | Статус v4 | Доказательство |
|---|---|---|
| `collectSheet` ставит `COLLECTED` при ошибках `repay` | **исправлено** | `mfi.service.ts`: `allOk = errorCount === 0 && …`; при ошибке статус остаётся `OPEN`, бросается `BadRequestException` («left OPEN — one or more repayments failed»). |
| Нет общей транзакции на пачку | **ещё открыто** | Погашения по-прежнему идут циклом `await this.loans.repay(...)` (каждое — своя проводка), затем отдельный `collectionSheet.update`. Успевшие `repay` **не откатываются**. Листа нет в одном `Serializable` tx. |
| Сумма в idempotency-ключе | **исправлено** | Ключ теперь `mfi-sheet-${sheetId}-${line.loanId}` (без суммы). Повтор того же листа+займа идемпотентен. Оговорка: изменить сумму при retry уже нельзя — вернётся первая проводка. |
| `accrueFinanceIncome` без проверки `lastFinanceAccrualDate` | **исправлено** | Сравнение UTC-дня `lastDay === asOfDay` → `skipped: true`, `dailyIncomeMinor: "0"`. |
| Нет GL-проводки начисления | **ещё открыто** | Комментарий и `note` прямо: «GL post deferred (INTEREST_INCOME)»; обновляется только регистр договора. |
| `DRAFT` → `ACTIVE` без проводки выдачи | **исправлено** | Accrue разрешён только при `LeaseContractStatus.ACTIVE`; иначе «DRAFT→ACTIVE requires originate/disburse path, not accrual». |
| `Number()` от денежных сумм в `lease-ifrs16.util.ts`, `ecl.engine.ts`, `loan-schedule.util.ts` | **исправлено** | Суммы идут через `mulRateRound`. `Number(rateAnnual)/12` — только ставка. В ECL `Number(covScaled)/Number(SCALE)` — отношение coverage (scale 1e6), не outstanding. |
| Write-off: `autoApprove: true` и maker `risk-system` | **исправлено** (остаточный обход maker — §3) | `autoApprove: false`; `assertUmidsizWriteOffSoD` отклоняет пустые id, совпадение maker/checker и системных акторов (`risk-system` / `service` / `eod-system` / `system`). Контроллер требует JWT `checkerUserId` (`ForbiddenException`, больше нет `?? "service"`). |
| Нет BFF `/api/leasing/*` в ДБО | **не исправлено** | `era-bank-dbo/app/api/leasing` по-прежнему нет; `page.tsx` лизинга не менялся (03:26). Клиент двигателя есть, Next-обёртки нет. |

---

## 3. Новые и остаточные дефекты в изменённом коде

1. **Maker списания можно подставить в теле запроса.**  
   `risk.controller.ts`: `makerUserId: body?.makerUserId`, затем в сервисе `input.makerUserId \|\| completed?.makerUserId`. Checker может указать любой чужой (не системный) id и пройти SoD, даже если классификацию делал `risk-system`. Ops UI (`prudential/page.tsx`) сам предлагает ввести maker, если в прогоне системный актор. Нужно брать maker **только** из завершённого classification run (человеческий) либо из отдельного maker-шага, а не из произвольного JSON.

2. **`autoApprove: false` на write-off почти ничего не даёт в posting engine.**  
   Тип проводки по-прежнему `TxnType.FEE`; комментарий в сервисе честно говорит, что FEE не входит в controlled types, поэтому checker движка не вызывается. SoD живёт только в `assertUmidsizWriteOffSoD`. Это приемлемо, если maker достоверный (см. п. 1). Зависимость от сид-филиала `code: "HQ"` не снята.

3. **Пустой список линий помечает collection sheet как `COLLECTED`.**  
   `allOk = errorCount === 0 && (attemptCount > 0 \|\| input.lines.length === 0)` — вызов с `lines: []` проходит. Параллельные `collect` по одному OPEN-листу без `SELECT FOR UPDATE` тоже возможны.

4. **Начисление лизинга без блокировки строки (гонка за день).**  
   Проверка `lastFinanceAccrualDate` и `update` не в одной транзакции с `FOR UPDATE`. Два параллельных POST за тот же UTC-день могут оба пройти проверку и удвоить регистр. Пропущенные дни не доначисляются (одна «дневная» сумма) — для lab допустимо, но это не акт/365 накопленным числом дней.

5. **В только что поправленном `capital.service.ts` отношение капитала всё ещё через `Number(bigint)`.**  
   RWA считается `mulRateRound`, но `carRatio = Number(total) / Number(carRwa)` и `pctOfCapital = Number(outstandingMinor) / Number(capital)`. Для дефолтного Tier 1 `1e10` это ещё в пределах safe integer, на больших книгах точность плывёт. Это файл, который правили в этой волне.

`risk.service.ts` (ECL provision) по-прежнему постит с `autoApprove: true` и `makerUserId ?? "risk-system"` — не новый баг этой волны, но тот же паттерн, что закрывали на ümidsiz.

---

## 4. Открытые пункты v3 вне этой волны (без изменений файлов)

Все перечисленные ниже файлы **старше 03:50**, поведение то же, что в v3:

| Тема | Статус | Коротко |
|---|---|---|
| Санкционный список только seed | **ещё открыто** | `sanctions-seed.json` / `aml.service.ts`, `sanctions-seed-v2-LAB-NOT-LIVE`. Живого ingest нет. |
| Рельсы AZIPS/XÖHKS/AÖS/SWIFT, `accepted: true` | **не исправлено** | `rail-stub.submit.ts` + адаптеры; `LAB_ONLY_NOT_LIVE_RAIL`. |
| Карточный процессинг | **не исправлено** | `MockAzeriCardGateway` в `cards.module.ts`. |
| Open Banking vs Manual v1.3 ЦБА | **ещё открыто** | 90 дней + `validateOpenBankingScaChallengeId` (любая непустая строка → `ACTIVE`). Шлюза ЦБА нет. |
| Календарь займа только сб/вс | **ещё открыто** | `loan-date.util.ts`: «Skip Sat/Sun (lab)». |
| CKR / FMN lab | **ещё открыто** | `STUB_CKR_LAB`, `submittedLive: false`; FMN `schemaVersion = "FMN-TEST-1"`. |

Миграции после v3 не добавлялись; сверка схемы не требовалась.

---

## 5. Сноска по документам

Код снова ушёл вперёд (SoD write-off, money-rate, collectSheet). Если Inventory/план не понижают lab-контур (Open Banking, рельсы, санкции) — завышение то же, что в v3. Документы в этом проходе не разбирались.

---

## 6. Источники

- `era-bank-core/apps/api/src/common/money-rate.util.ts`, `__tests__/money-rate.spec.ts`
- `era-bank-core/apps/api/src/modules/mfi/mfi.service.ts`
- `era-bank-core/apps/api/src/modules/leasing/leasing.service.ts`, `lease-ifrs16.util.ts`, `leasing.shape.ts`
- `era-bank-core/apps/api/src/modules/loans/loan-schedule.util.ts`
- `era-bank-core/apps/api/src/modules/risk/ecl.engine.ts`, `capital.service.ts`, `risk.service.ts`, `prudential-provisioning.service.ts`, `umidsiz-write-off.util.ts`, `risk.controller.ts`, `__tests__/umidsiz-write-off.spec.ts`
- `era-bank/app/risk/prudential/page.tsx`
- `era-bank-dbo/app/(customer)/leasing/page.tsx`, `era-bank-dbo/app/api/` (каталога `leasing` нет)
