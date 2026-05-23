# 7. Ночной аудит и отчёты (углублённо)

---

# Часть A — Night Audit

## A.1 Назначение

Закрытие **операционного** дня отеля и подготовка данных для менеджмента и ERP.

| Не делает | Делает |
|-----------|--------|
| Закрытие месяца GL | Room charges за день |
| Проводки NAS | Roll business date |
| Налоговые декларации | Z-отчёты, логи |

## A.2 Роли и время

| Роль | Обычно |
|------|--------|
| Night auditor | 23:00–02:00 |
| Manager | Эскалация блокеров |

**Операционная дата** (business date) ≠ календарная после roll.

## A.3 Мастер «Операция на конец дня»

**Экран:** WA0131 (wizard).

### Шаги wizard (концепт)

| # | Шаг | Авто/ручной | При fail |
|---|-----|-------------|----------|
| 1 | Pre-check: open cash shifts | Auto | Block |
| 2 | Pre-check: arrivals not assigned | Report | Warn |
| 3 | Post room charges | Auto | List errors |
| 4 | Post fixed charges (if any) | Auto | |
| 5 | No-show processing | Auto + confirm | |
| 6 | Folio exceptions | Report | Manager |
| 7 | Trial balance operational | Auto | |
| 8 | Archive daily reports | Auto | |
| 9 | Roll business date | Auto | |
| 10 | Queue ERP export | Auto | Retry later |

### Room charges (логика)

Для каждой **in-house** брони за дату D:

```
charge = rate(D) + meal_plan(D) + extras packaged
revenue code = ROOM / FOOD per breakdown
```

Пропуск если уже posted (idempotent).

### No-show

Брони **confirmed**, arrival = D, не check-in → статус no-show + penalty policy.

## A.4 Лог в конце дня

**Экран:** WA0150.

| Колонка | Содержание |
|---------|------------|
| Timestamp | |
| Step | |
| User | |
| Level | Info / Warning / Error |
| Message | |

**Использование:** разбор сбоев утром.

## A.5 Архивные отчёты

**Экран:** WA0188.

| № отчёта | Типичное содержание |
|----------|---------------------|
| 01 | Daily manager flash |
| 02 | Revenue summary |
| 03 | Arrivals/departures |
| 04 | Cashier summary |
| 05 | HK status |
| 06 | Trial balance ops |
| 07 | In-house list |

PDF/Excel snapshot **на дату D** — immutable.

## A.6 Журнал изменений броней

**Экран:** WA0192.

За день D: cancellations, modifications, rate changes — для аудита.

## A.7 Конец года

**Экран:** WA0170 — **вне фазы 1** (ERP).

## A.8 Автономный режим / сбой

- WA0117 — offline list in-house.  
- Если audit прерван — business date не roll; повтор с того шага.

## A.9 Связь с ERP

После успешного шага 10 — пакет E1 из [08-erp-handoff.md](08-erp-handoff.md).

## A.10 Пользовательские истории

| ID | История |
|----|---------|
| NA-01 | Night auditor запускает wizard в 00:30, 180 room charges |
| NA-02 | Блок: открыта смена кассира — звонит закрыть |
| NA-03 | Утром менеджер открывает архив вчерашнего дня |

---

# Часть B — Отчёты менеджера

## B.1 Назначение

KPI и операционные PDF без Excel.

## B.2 Панель отчётов

**Экран:** WA0059.

| Область | Метрики |
|---------|---------|
| Occupancy | % по датам |
| Revenue | Room, F&B, Med total |
| Quotes | OTB (on the books) |

Фильтр: date range, compare YoY (фаза 2).

## B.3 PDF-пакет

**Экран:** WA0058.

Кнопки быстрого доступа:

- Ежедневное управление  
- Итоги дня  
- In-house list  
- … (настраиваемый список)

## B.4 Заполняемость по питанию

**Экран:** WA0202 (must).

| Строка | BB | HB | FB |
|--------|----|----|-----|
| Rooms | | | |
| ADR | | | |
| RevPAR | | | |

## B.5 CRM / PMS дубли отчётов

WA0121 — daily status (overlap с dashboard) — **единый отчёт** в нашем продукте, не дублировать UI.

## B.6 Auto report sender

WA0345–0346 — email рассылка HTML отчётов — **фаза 2**.

## B.7 Каталог отчётов фазы 1

| ID | Отчёт | Потребитель | Частота |
|----|-------|-------------|---------|
| R01 | Daily operations flash | GM | Daily |
| R02 | Arrivals/departures | FO | Daily |
| R03 | In-house by room | FO, HK | Daily |
| R04 | Revenue by code | GM, Finance | Daily |
| R05 | Cashier summary | Finance | Daily |
| R06 | Agency statement | Sales | Weekly |
| R07 | Occupancy forecast 14d | Revenue | Daily |
| R08 | HK status summary | HK sup | Daily |
| R09 | No-show / cancel | Revenue | Daily |
| R10 | Med occupancy list | Doctor | Daily |

---

## Референс

WA0131, WA0150, WA0170, WA0188, WA0192, WA0058–0059, WA0202, WA0121.
