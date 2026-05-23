# 5. Фолио и касса — углублённо

## 5.0 Обзор

Операционный финансовый контур отеля. **Не GL.** Итоги уходят в ERP — [08-erp-handoff.md](08-erp-handoff.md).

| Экранов (манифест) | ~13 CASH + связанные PMS |
| Роли | Ресепшен, кассир, менеджер, night auditor |

---

## 5.1 Folio (счёт гостя)

### Структура

| Элемент | Описание |
|---------|----------|
| Folio header | Гость, бронь, валюта, статус open/closed |
| Charges (lines) | Дебет |
| Payments (lines) | Кредит |
| Balance | Σ charges − Σ payments |

### Типы folio

| Тип | Когда |
|-----|-------|
| Guest folio | Физическое лицо платит extras |
| Company folio | Компания платит ROOM |
| Agency folio | City ledger B2B |

### Folio routing (перенаправление)

**Экран:** WA0136.

| Правило | Пример |
|---------|--------|
| По revenue code | ROOM → company folio |
| По department | All Medical → guest |
| Default | Остальное → guest |

**Применение:** в момент posting charge автоматически выбирает target folio.

### Статусы folio

| Статус | Смысл |
|--------|-------|
| Open | Принимает charges/payments |
| Closed | Check-out завершён |
| Void | Ошибочный, не учитывается (manager) |

---

## 5.2 Начисления (charges)

### Источники

| Источник | Триггер | Экран/процесс |
|----------|---------|---------------|
| Room charge | Night audit | WA0131 |
| Manual | Ресепшен | Folio detail |
| Quick posting | Бар/мед без POS | WA0135 |
| Early/late | Check-in/out policy | Auto |
| Penalty | Cancel/no-show | Manual |
| Transfer in | Другой folio | WA0201 |

### Атрибуты charge (обязательные)

| Поле | Правило |
|------|---------|
| Дата (business) | Не будущая для closed day |
| Сумма | > 0, валюта |
| Revenue code | Из справочника |
| Department | Из справочника |
| Описание | Текст для гостя/счёта |
| Ссылка | Reservation / guest |
| Налоговая метка | Для ERP (18% и т.д.) |

### Корректировки

| Операция | Кто | Audit |
|----------|-----|-------|
| Void charge | Manager | Причина обязательна |
| Adjust amount | Manager | До night audit close |
| Transfer to folio | Reception | WA0201 |

---

## 5.3 Quick posting (быстрое начисление)

**Экран:** WA0135.

| Поле | Описание |
|------|----------|
| Поиск товара/услуги | Каталог quick items |
| Номер гостя / in-house list | Привязка |
| Касса | CASH / F&B TERMINAL / PAYRIFF |
| Документ № | Внутренний ref |

**Сценарий:** гость покупает воду → charge FOOD на folio 305 → оплата при check-out или сразу payment.

---

## 5.4 Платежи (payments)

### Типы

| Тип | Учёт в смене | Фискализация AZ |
|-----|--------------|-----------------|
| Cash | Да | KKM позже |
| Card (POS terminal) | Да | Acquirer |
| Bank transfer | Обычно B2B | — |
| Deposit apply | Зачёт аванса | — |
| City ledger | На счёт агентства | Invoice |

### Частичный платёж

- Разрешён на folio.  
- Balance уменьшается; check-out возможен при policy «company pays rest».

### Возврат (refund)

- Отрицательный payment или void payment.  
- Только manager + причина.

---

## 5.5 Кассовые смены

**Экраны:** WA0149, WA0172.

### Жизненный цикл смены

| Статус | Действия |
|--------|----------|
| Open | Кассир принимает cash/card |
| Close | Подсчёт наличных, Z-отчёт |
| Audited | Night audit проверил |

### Содержимое экрана «Касса»

| Колонка | Смысл |
|---------|-------|
| Кассир | Пользователь |
| CASH balance | Наличные в смене |
| Terminal | Карты |
| Расхождение | Система vs факт |

**Правило:** нельзя night audit при открытых сменах (настраиваемо WA0088).

---

## 5.6 Предоплата (deposit)

**Экран:** WA0145.

| Поле | Описание |
|------|----------|
| Бронь | Связь |
| Сумма, дата, способ | Payment |
| Статус | Held / Applied / Refunded |

**При check-in/out:** apply к folio уменьшает balance.

---

## 5.7 Курсы валют

**Экран:** WA0151.

| Поле | Правило |
|------|---------|
| Дата | Business date |
| EUR/USD → AZN | Курс |
| Источник | Ручной ввод (фаза 1) |

**Использование:** charges в EUR для иностранца → отображение в AZN по курсу дня; ERP получает обе валюты.

---

## 5.8 Счета-фактуры (invoices)

**Экран:** WA0108.

| Поле | Описание |
|------|----------|
| № счёта | Уникальный |
| Тип | Guest / Company / Agency |
| Период / строки | Из charges |
| НДС | Строки с tax |
| Статус | Draft / Issued / Cancelled |

**Процесс выписки:**

1. Выбрать folio или city ledger период.  
2. Сформировать preview.  
3. Issue → печать PDF.  
4. Событие для ERP / e-qaimə (фаза 2).

---

## 5.9 City ledger (B2B агентства)

### Концепция

Агентство накопило charges за брони → долг → оплата позже.

**Экраны:** WA0118, WA0157 (Agency Statement).

| Колонка отчёта | Смысл |
|----------------|-------|
| Agency | Название |
| Opening balance | На начало |
| New charges | За период |
| Payments | Погашения |
| Closing | Итог |

**В PMS:** операционный контроль. **В ERP:** проводки дебиторки.

---

## 5.10 Контроль задолженностей

**Экран:** WA0116 — бронирования с балансами folio.

| Индикатор | Действие |
|-----------|----------|
| Balance > 0 in-house | Напомнить оплату до check-out |
| Agency overdue | Менеджер связывает с agency |

---

## 5.11 Менеджерский KPI (касса)

**Экран:** WA0140 — представление менеджера (мобильный KPI).

ADR, RevPAR, отмены — read-only из PMS данных.

---

## 5.12 Связь с night audit

| До audit | Audit делает | После audit |
|----------|--------------|-------------|
| Charges за день вручную | Post room charges | День закрыт |
| Open shifts | Check shifts | Смены audited |
| Open folio policy | Report exceptions | ERP export |

---

## 5.13 Права

| Действие | Reception | Manager |
|----------|-----------|---------|
| Post charge | ✅ | ✅ |
| Payment | ✅ | ✅ |
| Void charge | ❌ | ✅ |
| Invoice issue | ✅ | ✅ |
| Close shift | ✅ (своя) | ✅ (все) |
| City ledger adjust | ❌ | ✅ |

---

## 5.14 Пользовательские истории

| ID | История |
|----|---------|
| FIN-01 | Принять наличные 200 AZN на folio 412 и выдать чек |
| FIN-02 | Разделить: ROOM на компанию, бар на гостя (routing) |
| FIN-03 | Зачесть депозит 500 при check-out |
| FIN-04 | Выписать счёт компании за месяц (city ledger) |
| FIN-05 | Night audit: не закрыть день пока касса Ali открыта |

---

## Референс

WA0108, WA0116–0118, WA0135–0136, WA0139–0140, WA0145, WA0149–0151, WA0157, WA0172, WA0201.
