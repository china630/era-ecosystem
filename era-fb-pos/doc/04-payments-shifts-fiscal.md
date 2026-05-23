# 04. Оплата, смены, фискал

## 4.1 Способы оплаты

| Способ | KKM | События |
|--------|-----|---------|
| Cash | Да | E3 + E7 |
| Card (POS terminal) | Да | E3 + E7; ref terminal |
| **Room charge** | Нет на столе | PMS room-charge → PMS E2/E1 цепочка |
| City ledger / B2B | Редко | E2 через Finance |
| Mixed | Комбо | Несколько payment rows |

### Room charge — UX

1. Официант выбирает «На номер».
2. Поиск гостя (PMS in-house list).
3. Подтверждение суммы (полный чек или split part).
4. fb-pos: `POST` PMS room-charge с idempotency key = ticketId.
5. При успехе → ticket CLOSED, стол FREE.
6. При ошибке — показать причину (не in-house, folio closed, лимит).

### Split bill

| Режим | Описание |
|-------|----------|
| Equal split | N гостей |
| By seat | Позиции на гостя |
| Custom | Суммы вручную |

Каждая часть — отдельный payment; room charge может быть только на одну часть.

---

## 4.2 POS shift (X / Z)

По WA0098 Elektraweb.

### Открытие смены

| Поле | |
|------|--|
| Outlet | |
| Cashier | |
| Opening float | Размен |

### X-report (промежуточный)

- Не закрывает смену.
- Сверка cash vs система.
- Печать для менеджера.

### Z-report (закрытие)

| Проверка | Блокирует Z? |
|----------|--------------|
| Open tickets | **Да** (настройка WA0098) |
| Unsent KDS | Предупреждение |
| Cash variance | Подпись manager |

### Связь с hotel-pms night audit

| Сигнал | Действие |
|--------|----------|
| `PosShift.status = OPEN` | PMS night audit **блокируется** (как CashShift FIN-05) |
| API | fb-pos exposes `GET /api/pos/shifts/open` или push to PMS |

---

## 4.3 Фискализация (AZ)

См. [17-az-compliance.md](../clone-spec/17-az-compliance.md).

| Сценарий | Где чек |
|----------|---------|
| Cash/card в ресторане | KKM через `FiscalProvider` в fb-pos |
| Room charge | KKM при check-out / invoice — **не** в fb-pos |
| e-qaimə B2B | ERP |

### E7 payload (логический)

- ticketId, paymentId, amount, receiptId, qrPayload, outletCode

---

## 4.4 Скидки и void

| Операция | Кто | Audit |
|----------|-----|-------|
| Void line | Manager | reason code |
| Void ticket | Manager | reason |
| Discount % | Manager | max % в настройках |
| Reopen closed ticket | Manager + 24h policy | rare |

---

## 4.5 Отчёты смены (операционные)

| Отчёт | Содержание |
|-------|------------|
| Sales by category | Выручка FOOD/BAR |
| Payments breakdown | cash vs card vs room |
| Voids/discounts | Audit |
| Waiter performance | Tickets, average check |
| Room charges list | Для сверки с PMS |

GL-отчёты — только Finance.
