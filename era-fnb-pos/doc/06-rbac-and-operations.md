# 06. RBAC и операции

## Роли

| Роль | Код | Права |
|------|-----|-------|
| Waiter | `FB_WAITER` | Open ticket, order, precheck, fire kitchen |
| Cashier | `FB_CASHIER` | + payments (not room without flag) |
| Head waiter | `FB_HEAD` | + transfer, split, room charge |
| Manager | `FB_MANAGER` | + void, discount, Z, reopen, settings |
| Kitchen | `FB_KITCHEN` | KDS only |
| Viewer | `FB_VIEWER` | Read-only reports |

Cross-system: **Financial_Auditor** из ERA Core — read-only reports (SSO как в PMS).

---

## Матрица разрешений (сокращённо)

| Permission | Waiter | Cashier | Manager |
|------------|--------|---------|---------|
| ticket.open | ✓ | ✓ | ✓ |
| ticket.order | ✓ | ✓ | ✓ |
| ticket.precheck | ✓ | ✓ | ✓ |
| payment.cash_card | — | ✓ | ✓ |
| payment.room_charge | — | ✓* | ✓ |
| ticket.void | — | — | ✓ |
| discount.apply | — | — | ✓ |
| shift.z_close | — | — | ✓ |
| menu.manage | — | — | ✓ |
| kds.bump | kitchen | kitchen | ✓ |

\* room charge для cashier — настройка outlet.

---

## Аудит

| Событие | Лог |
|---------|-----|
| Void line/ticket | user, reason, before/after |
| Discount | user, %, amount |
| Z-close | snapshot totals |
| Room charge fail/success | correlation id, PMS response |

---

## Операционный день

| Время | Действие |
|-------|----------|
| Утро | Open POS shift |
| День | Tickets |
| Вечер | Z-close всех outlet |
| Ночь | PMS night audit (блок если POS shift open) |

---

## Offline / degraded (фаза 2)

| Режим | Поведение |
|-------|-----------|
| PMS недоступен | Room charge disabled; cash/card OK |
| ERP недоступен | Queue E3/E7/E8; local allow sale |
| KKM error | Payment blocked for fiscal methods |

Nafta v1 — online-only.
