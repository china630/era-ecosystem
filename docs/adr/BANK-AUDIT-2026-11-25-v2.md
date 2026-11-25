# Аудит v2 — повторная проверка банка после доработок Cursor

**Дата аудита:** 25.11.2026, 02:35 (Asia/Baku, UTC+4)  
**Аудитор:** Мика (только чтение; в проекте изменён лишь этот отчёт)  
**Эталон:** `docs/adr/BANK-AUDIT-2026-11-25.md` (25.11.2026 02:03, 29 413 байт)  
**Объект:** незакоммиченное рабочее дерево `era-bank-core` / `era-bank` / `era-bank-dbo` / `docs/adr` / acceptance  
**Тесты и typecheck:** не запускались.

Обозначения по пунктам прошлого аудита: **исправлено** · **частично / ещё открыто** · **не исправлено** · **новая регрессия**.

---

## 0. Что изменилось с прошлого аудита

За ~30 минут Cursor закрыл большую часть *конкретных багов* из v1, добавил UI и честнее подписал заглушки. **Коммитов по банку по-прежнему нет** (`git log --since='2026-11-25 02:00' -- era-bank*` пуст). Вся работа снова только в working tree.

Появилось с 02:03:

- страницы `era-bank/app/leasing`, `app/mfi`, `app/risk/prudential` и ДБО `(customer)/leasing`, `(customer)/loans` (досрочка + ФГПС);
- миграция `20261125160000_loan_quality_flags` (девятая незакоммиченная);
- правки `treasury.service.ts`, `posting-engine.service.ts` (`sideEffectsInTx`, пересчёт available, `nostroAdjustments`);
- честнее ASAN / ЦКР / рельсы; расширенный `sanctions-seed.json`;
- восстановлен цельный gap-анализ и нормальное разбиение `docs/adr/bank/00–02`.

План `.cursor/plans/bank-cbs-full.plan.md` добавил «Honesty note» и честный unchecked пункт про `db:migrate`, но волны по-прежнему помечены `completed`.

---

## 1. Сводка по 24 пунктам P0–P2

Сравнение со статусами v1 (сделано 2 / частично 19 / не сделано 3).

| Статус сейчас | Число | Изменение |
|---------------|-------|-----------|
| Сделано | **2** | без изменений (P2-1, P2-9) |
| Частично | **20** | +1: P2-6 (ДБО) с «не сделано» перешёл в «частично» |
| Не сделано | **2** | −1: остались P1-4 (боевые рельсы) и P2-8 (боевые карты) |

Глубина многих «частично» выросла (P0-1, P0-3, P0-4, P1-1/2, P1-7, P1-8, P2-2), но до полного AC из исходного gap-анализа они не дотягивают: нет живых партнёрских интеграций, МСФО 16, аудируемого МСФО 9, официального XSD ЦБА/СФМ.

Кратко по ID (где статус волны не сменился, указано, что именно добили):

- **P0-1** частично — treasury переведён на posting engine; available пересчитывается из холдов; появился opt-in DB-тест (см. баги).
- **P0-2** частично — без изменений по сути (гейт БОКТ на депозиты есть, бандлов и ограничений для лизинговой компании нет).
- **P0-3** частично — `qualityFlagsJson` на договоре, UI `/risk/prudential`. Списания ümidsiz по-прежнему нет.
- **P0-4** частично — досрочка атомарна, стабильный idempotency, пени в водопаде, начисление без счёта больше не двигает регистр. Переноса дат на календарь ЦБА нет.
- **P0-5** частично — без живой подачи и официальных форм.
- **P0-6** частично — seed списков расширен до 18 имён; живого ingest нет; FMN всё ещё `FMN-TEST-1`.
- **P1-1 / P1-2** частично — появился ops UI (и ДБО-список лизинга). МСФО 16, collection sheet, полевой офицер — нет.
- **P1-3** частично — stub больше не маскируется под живую подачу.
- **P1-4** **не сделано** — те же lab-stub адаптеры, только честнее подпись `LAB_ONLY_NOT_LIVE_RAIL`.
- **P1-5** частично — лимит 90 дней есть; `CAP-DBO-OB` всё ещё `IN`, шлюза ЦБА нет.
- **P1-6** частично — ECL суммирует `LoanCollateralLink`, двойной учёт по-прежнему закрыт; lifetime/сценарии/дисконт нет.
- **P1-7** частично — налог больше не через `Number(сумма)*rate`.
- **P1-8** частично — `startChallenge` ждёт HTTP; `completeChallenge` в live по-прежнему бросает ошибку.
- **P1-9** частично — связи залогов используются в ECL.
- **P2-1** сделано (оговорка про оставшиеся `IN` у части lab-строк сохраняется).
- **P2-2** частично — появился `deliver()` с 3 попытками; durable outbox нет (Inventory: SCAFFOLD).
- **P2-3…P2-5, P2-7** частично — как в v1 (скаффолды / только ADR).
- **P2-6** теперь **частично** (было «не сделано»): ДБО показывает ФГПС и досрочку, список лизинга есть; полного графика в ДБО нет.
- **P2-8** **не сделано**.
- **P2-9** сделано (решение не продавать pension/PSA).

---

## 2. Баги из аудита v1 — статус

| Баг из v1 | Статус | Доказательства |
|-----------|--------|----------------|
| Казначейство пишет `ledgerBalanceMinor` напрямую | **исправлено** | В `treasury.service.ts` нет `decrement`/`increment`. Остатки ностро идут через `postingEngine.post({ nostroAdjustments })` + `lockNostroAccountsForUpdate` в `posting-engine.service.ts`. |
| Фейковый тест конкуренции | **частично** | Юнит-цикл в памяти остался, но честно подписан: «not a substitute for the DB integration test». Добавлен opt-in `describe` при `BANK_CONCURRENCY_DB_TEST=1`. **Но этот тест сломан** (см. §3). По умолчанию в CI не идёт. Implementation Matrix это оговаривает. |
| Досрочка не в одной транзакции | **исправлено** | `loans.service.ts` `prepay()`: обновление `outstandingMinor` и пересчёт графика в `sideEffectsInTx` внутри `postingEngine.post` (`posting-engine.service.ts` ~стр. 113–114). |
| `Date.now()` в ключе идемпотентности | **исправлено** | Ключ: клиентский или `loan-prepay-${id}-${stateHash}` (sha256 от суммы, режима, outstanding и `updatedAt`). `Date.now()` в prepay больше нет. |
| ASAN `void fetch` | **исправлено** (старт) | `FinancePortAsanSimaAdapter.startChallenge` теперь `async`, ждёт `fetch`, при сетевой/HTTP ошибке бросает, а не возвращает успех. `completeChallenge` в live **по-прежнему** бросает ConfigError — это открытый хвост P1-8, не ложный успех. |
| Налог с вкладов через float | **исправлено** | `deposit-interest-wht.util.ts`: `whtMinor = (incrementalTaxable * rateBp + 5000n) / 10000n`. `Math.round` только для ставки в базисных пунктах, не для суммы. |
| Stub ЦКР как успех (`STUB_CKR_SUBMITTED`) | **исправлено** | `submitBatch` stub: `provider: "STUB_CKR_LAB"`, `submittedLive: false`. |
| 4 демо-имени в санкциях | **частично** | `sanctions-seed.json` расширен до 18 записей (OFAC/EU/UN/LOCAL, часть — узнаваемые имена, часть — demo). Это всё ещё **локальный seed**, не живая загрузка списков. `CAP-AML-FEED` остаётся BLOCKED. |
| 8 незакоммиченных миграций | **не исправлено** | Теперь **9** папок, все untracked, коммита нет, на окружениях, скорее всего, не применены. Новая: `20261125160000_loan_quality_flags`. План честно оставил `[ ] Apply Prisma migrations`. |
| Нет UI лизинга / МФО / резервов ЦБА | **исправлено** (SCREEN, не UAT) | Ops: `era-bank/app/leasing/page.tsx`, `app/mfi/page.tsx`, `app/risk/prudential/page.tsx` + пункты в `BankOpsShell.tsx`. Маршруты закрыты `SCREEN_LOANS` / `SCREEN_RISK`. BFF-прокси `leasing`, `mfi`, `risk` есть в `engine-proxies.ts`. ДБО: список лизинга и досрочка/ФГПС. Отдельных permission-ключей `leasing`/`mfi` нет — переиспользуются кредитные/риск. |
| Рельсы-заглушки | **не исправлено** | `rail-stub.submit.ts` по-прежнему `accepted: true`, `simulatedAck: true`. Честнее: `processorRef: STUB-LAB-…`, `labOnly: true`, `warning: LAB_ONLY_NOT_LIVE_RAIL`. Live-режим бросает ConfigError. ISO/camt/AÖS 24/7 не появились. |
| План «всё completed» | **частично** | Добавлена таблица «`[x]` = code wave, не sell-ready» и открытые пункты про migrate / партнёров. Сами волны P0–P2 и «audit-diamond-pass» всё ещё `status: completed`. |
| Gap-анализ-заглушка и тройные копии 00–02 | **исправлено** | `docs/adr/bank-satellite-gap-analysis.md` снова полный файл (63 004 байт, шапка: «code HAS changed since»). `00` = §§0–7 (28 755), `01` = §8 (9 162), `02` = §§9–11 (24 459) — реальное разбиение, не три копии. Корневые ADR (`era-bank-core.md` и др.) **по-прежнему заглушки** (172 байт) со ссылкой на `docs/adr/bank/`. |

Прочие хвосты v1, которые тоже подправили:

- начисление процентов без `accountId` больше **не** увеличивает регистр (`loans.service.ts`, комментарий «no field bump without a posting»);
- водопад погашения берёт пеню первым этапом (`loan-repay.util.ts`);
- ECL берёт сумму с `LoanCollateralLink`, иначе fallback на `collateralRef`;
- `availableBalanceMinor` пересчитывается из ledger и холдов (`applyBalanceUpdates`); EOD зовёт `ledger.recomputeAvailable` после истечения холдов.

Ещё открыто из v1: списание ümidsiz; календарь рабочих дней ЦБА (СФМ по-прежнему сб/вс); проценты графика через `Number(remaining)`; проверка идемпотентности `findUnique` **снаружи** транзакции (гонка двух одинаковых ключей ловится только unique constraint, отдельного retry на P2002 нет).

---

## 3. Новые баги и риски в свежем коде

1. **Регрессия в opt-in тесте конкуренции (важно).** `posting-concurrency.spec.ts` при `BANK_CONCURRENCY_DB_TEST=1` делает `prisma.bankOrganization.findFirst`. В схеме **нет** модели `BankOrganization` — есть `BankInstitutionConfig` и поле `bankOrgId` на сущностях. Если тест включить, он упадёт на этапе подготовки, а не проверит гонку. Тест к тому же бьёт в хелперы (`runSerializableMoneyTx` + прямой `account.update`), а не в `PostingEngineService.post`.
2. **Списание ümidsiz** по правилам ЦБА по-прежнему отсутствует (`prudential-provisioning.service.ts` — 0 совпадений `writeOff`/`UMIDSIZ` в логике списания; категория в enum есть, проводки списания нет).
3. Идемпотентность постинга: `findUnique` до `$transaction`. При параллельном prepay с одним ключом один запрос может получить P2002 вместо уже существующей проводки.
4. ДБО-досрочка и ops-досрочка передают относительно стабильные ключи (`dbo-ui-…`, `ops-prepay-…` без timestamp) — это хорошо. Повтор той же суммы до смены `updatedAt` на сервере (если клиент не прислал ключ) защищён `stateHash`.
5. Санкционный seed с реальными именами (Путин, Ким и т.д.) — для лаборатории ок, но это **не** актуальные официальные перечни; нельзя предъявлять как скрининг.
6. Миграции (9 штук) всё ещё не в git — риск расхождения схемы.

Новых дыр во владельчестве ДБО-досрочки не видно: сначала `accounts.getLoan(req.customerAuth, id)`, иначе 404.

---

## 4. Документы против кода

Совпало / стало честнее:

- Inventory: LEASE/MFI = PARTIAL с пометкой про UI/BFF; FMN DECLARED; FEED BLOCKED; WEBHOOK SCAFFOLD с retries; edition `mvp`.
- Implementation Matrix: явно пишет, что unit-тест ≠ DB race без флага; sell/pilot не поднимают.
- Product Readiness: UI лизинга/МФО/пруденциала больше не «follow-up отсутствует».
- Gap-анализ восстановлен, разбиение 00–02 настоящее, статус «код уже менялся».
- План отличает lab от live, но всё ещё рисует галочки `completed` на неполных волнах.

Расхождения, которые остались:

| Документ | Утверждение | Факт |
|----------|-------------|------|
| План bank-cbs-full | Волны и «audit-diamond-pass» completed | P1-4 и P2-8 не сделаны; много пунктов частично; DB-тест конкуренции нерабочий |
| `Bank-Capability-Inventory.md` | `CAP-DBO-OB = IN` | По стандарту ЦБА закрыт только срок согласия 90 дней, не шлюз и не мануал v1.3 |
| План / комментарии | «opt-in DB concurrency test» как закрытие алмаза P0-1 | Тест обращается к несуществующей модели `bankOrganization` |
| Корневые `docs/adr/era-bank-core.md` и 5 соседних | Заглушка «Moved» | Канон в `docs/adr/bank/`; старые закладки без перехода дают только 6 строк |

TZ/PRD/edition (`mvp`, `pilot_ready: false`) по-прежнему честно не обещают GA.

---

## 5. Что закрывать дальше (порядок)

1. Починить DB-тест P0-1 (искать банк по реальной модели / `bankOrgId`, лучше гонять через `PostingEngineService.post`) и хотя бы один раз прогнать его на стенде.
2. Закоммитить код **вместе** с 9 миграциями и прогнать `db:migrate` + `db:seed` (открытый пункт плана).
3. Не называть рельсы и карты закрытыми, пока нет стенда ЦБА/процессинга.
4. Добавить списание ümidsiz и не поднимать `CAP-DBO-OB` выше PARTIAL/DECLARED, пока нет шлюза ЦБА.
5. Корневые ADR-заглушки оставить только если все ссылки в репозитории уже ведут в `docs/adr/bank/`.

---

## 6. Источники

`docs/adr/BANK-AUDIT-2026-11-25.md`  
`era-bank-core/apps/api/src/modules/treasury/treasury.service.ts`  
`era-bank-core/apps/api/src/kernel/posting-engine/{posting-engine.service.ts,posting-money-tx.ts,posting-engine.types.ts}`  
`era-bank-core/apps/api/__tests__/posting-concurrency.spec.ts`  
`era-bank-core/apps/api/src/modules/loans/loans.service.ts`  
`era-bank-core/apps/api/src/integration/asan-sima.adapter.ts`  
`era-bank-core/apps/api/src/modules/deposits/deposit-interest-wht.util.ts`  
`era-bank-core/apps/api/src/modules/loans/credit-registry.adapter.ts`  
`era-bank-core/apps/api/src/modules/aml/sanctions-seed.json`  
`era-bank-core/apps/api/src/modules/payments/rail-stub.submit.ts`  
`era-bank-core/apps/api/src/modules/{webhooks,risk,dbo}/*`  
`era-bank/app/{leasing,mfi,risk/prudential}/page.tsx`  
`era-bank-dbo/app/(customer)/{leasing,loans}/page.tsx`  
`docs/adr/bank-satellite-gap-analysis.md`, `docs/adr/bank/00*.md`…`02*.md`  
`.cursor/plans/bank-cbs-full.plan.md`  
`docs/acceptance/Bank-Capability-Inventory.md`, `Bank-Implementation-Matrix.md`
