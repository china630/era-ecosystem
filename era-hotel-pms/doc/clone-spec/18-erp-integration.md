# 18. Интеграция с ERP Nafta (контракт на уровне бизнеса)

> Развитие [08-erp-handoff.md](08-erp-handoff.md) для фазы 2  
> **Без** OpenAPI/JSON Schema — только сущности, события, правила; тех. спека — после ответов §C чеклиста 13

## 18.0 Цели

| # | Цель |
|---|------|
| 1 | Однозначный обмен после night audit и в реальном времени |
| 2 | Идемпотентность и журнал доставки |
| 3 | Обратная связь fiscal / GL статусов (read-only в PMS) |
| 4 | Основа для перепродажи (открытый контракт партнёрам) |

---

## 18.1 Роли систем

| Система | Владелец данных |
|---------|-----------------|
| PMS | Бронь, folio, операционный день, коды дохода (мастер или зеркало) |
| ERP | GL, NAS, контрагенты B2B, e-qaimə submit, закрытие месяца |
| Fiscal gateway | KKM, опционально прокси e-qaimə |

---

## 18.2 Транспорт (решение на проектировании)

| Вариант | Когда |
|---------|-------|
| REST webhook PMS → ERP | Real-time E2, E3 |
| REST pull ERP ← PMS | Ночной пакет E1 |
| Message queue | Высокая надёжность |
| File drop (XML/CSV) | Legacy 1C — **fallback** |

**Требования независимо от транспорта:**

- `correlation_id` на каждое событие  
- `hotel_id` / `property_code`  
- `occurred_at` UTC  
- Повтор при 5xx с exponential backoff  
- Dead letter после N попыток + UI журнал WA0274-аналог

---

## 18.3 Каталог событий (полный)

### E1 — operational_day_closed

| Поле | Тип (бизнес) | Пример |
|------|--------------|--------|
| business_date | date | 2026-05-19 |
| night_audit_id | id | NA-20260519-001 |
| revenue_lines[] | aggregate | code ROOM, dept Accommodation, net 12500 AZN |
| payment_lines[] | aggregate | cash 5000, card 8000 |
| vat_summary[] | optional | 18% base 10000 tax 1800 |

**Частота:** 1× в сутки после успешного night audit.

---

### E2 — invoice_issued

| Поле | Описание |
|------|----------|
| invoice_number | |
| issue_date | |
| counterparty_type | guest / company / agency |
| counterparty_tax_id | VÖEN для B2B |
| lines[] | description, revenue_code, qty, amount, vat_rate |
| reservation_ref | |
| folio_ref | |
| fiscal_status | pending / sent / accepted / rejected *(обратно ERP)* |
| fiscal_external_id | id e-qaimə |

---

### E3 — payment_received

| Поле | Описание |
|------|----------|
| payment_id | |
| amount | |
| currency | AZN default |
| method | cash / card / bank / deposit_offset |
| folio_ref | optional |
| agency_ref | city ledger |
| cash_shift_ref | |
| pos_shift_ref | фаза 2 |

---

### E4 — city_ledger_snapshot

| Поле | Описание |
|------|----------|
| agency_id | |
| as_of_date | |
| balance | |
| period_charges | |
| period_payments | |

---

### E5 — master_data_sync

| Направление | Содержание |
|-------------|------------|
| PMS → ERP | revenue_codes, departments, vat_rates |
| ERP → PMS | *(опционально)* mapping account codes read-only |

**Владелец кодов дохода:** зафиксировать в чеклисте C2.

---

### E6 — invoice_fiscal_status_changed *(ERP → PMS)*

| Поле | Описание |
|------|----------|
| invoice_ref | |
| fiscal_status | |
| rejection_reason | |
| updated_at | |

---

### E7 — fiscal_receipt_issued *(фаза 2, AZ)*

См. [17-az-compliance.md](17-az-compliance.md).

---

### E8, E9, E10 — склад

См. [16-stock-procurement.md](16-stock-procurement.md).

---

## 18.4 Идемпотентность

| Правило | Реализация (концепт) |
|---------|----------------------|
| Ключ | `event_type` + `source_id` + `hotel_id` |
| Дубликат | ERP возвращает 200 «already processed» |
| Повтор night audit | Запрет в PMS; E1 только из closed audit |

---

## 18.5 Журнал интеграции (UI)

Аналог Elektraweb WA0247–0248 / Sage WA0274:

| Колонка | Описание |
|---------|----------|
| Time | |
| Event | E1…E10 |
| Status | pending / ok / error |
| Payload ref | Ссылка на JSON/archive |
| Retry | Кнопка для admin |

**Роли:** админ отеля, интегратор (read-only для бухгалтера).

---

## 18.6 Ошибки и компенсации

| Ситуация | Действие |
|----------|----------|
| ERP недоступен при E1 | Night audit **успешен** в PMS; E1 в очереди; alert |
| Отклонён e-qaimə | Бухгалтер исправляет в ERP; E6 обновляет PMS |
| Расхождение сумм E1 vs folio | Отчёт reconciliation (фаза 2) |

**Не автоматизировать:** сторно проводок в PMS.

---

## 18.7 User stories (интеграция)

| ID | История |
|----|---------|
| ERP-01 | После night audit пакет E1 в ERP за 5 мин |
| ERP-02 | Бухгалтер видит invoice «отклонён e-qaimə» в PMS |
| ERP-03 | Повтор E1 вручную после сбоя сети |
| ERP-04 | Изменение кода MEDICAL → E5 в ERP |

---

## 18.8 Этапы внедрения

| Этап | События | Срок ориентир |
|------|---------|---------------|
| MVP | E1, E3 | 1–2 спринта после ф.1 |
| + | E2, E6 | + fiscal |
| + | E4, E5 | city ledger |
| + | E7–E10 | с POS/склад/AZ |

---

## 18.9 Связь с Elektraweb ACC (Nafta screens)

| Экран | Наш эквивалент |
|-------|----------------|
| WA0274 Sage export | Журнал E1/E2 |
| WA0278 e-invoice settings | Конфиг FiscalProvider (AZ) |
| WA0097 Accounting settings | Маппинг в 09, не GL |
| WA0298 Import panel | E5 bulk import |

---

## 18.11 Пользователи сателлита (не GL RBAC)

| Вопрос | Ответ |
|--------|-------|
| Где живут логины портье/HK? | Только PostgreSQL сателлита `era-hotel-pms` |
| Знает ли ERP пароль reception? | **Нет** |
| Что контролирует ERP? | **Seat quota** при создании user ([20-seat-licensing.md](20-seat-licensing.md)) |
| Исключение SSO | Бухгалтер GL → `Financial_Auditor` read-only ([21-satellite-rbac.md](21-satellite-rbac.md) § SSO) |
| GL-роли бухгалтера | Не маппятся 1:1 на Receptionist |

Операционные события E1–E10 не заменяют локальный JWT; outbound integration token — для шлюза 1C/ERA, не для staff login.

---

## 18.10 Статус

Контракт согласовать с командой ERP Nafta → затем техническая спека (OpenAPI) в репозитории `api/` — **отдельный репозиторий/папка по решению команды**.
