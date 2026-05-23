# 22. Исходящие события PMS → ERP (политика и настройки)

> Решение по **C4** (чеклист 13): **real-time** по операциям folio + **E1** агрегат после night audit.  
> Nafta не блокирует — каждый канал можно **отключить** в настройках отеля.

## Принцип

| Режим | Когда | Зачем |
|-------|-------|-------|
| **Real-time** | Charge, payment, void, check-out | ERP/Finance видит оборот без ожидания ночи |
| **E1 batch** | После night audit | Сверка дня, закрытие операционной даты (дубль-контроль) |

При сбое сети: **операция в PMS успешна**, событие в `OutboundEventLog` + Redis retry (как сейчас check-out).

## События (маппинг на [08-erp-handoff.md](08-erp-handoff.md))

| Триггер в PMS | `eventType` (satellite) | ERP (логически) | Real-time default |
|---------------|-------------------------|-----------------|-----------------|
| Post charge | `SATELLITE_HOTEL_FOLIO_CHARGE_POSTED` | E2 line / accrual | ☑ on |
| Post payment | `SATELLITE_HOTEL_FOLIO_PAYMENT_RECEIVED` | E3 | ☑ on |
| Void charge | `SATELLITE_HOTEL_FOLIO_CHARGE_VOIDED` | Reversal | ☑ on |
| Check-out | `SATELLITE_HOTEL_RESERVATION_COMPLETED` | E2+E3 snapshot | ☑ on |
| Night audit closed | `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` | E1 | ☑ on (отдельный URL) |

**Не в real-time (фаза 2):** смена тарифа, смена master data, city ledger snapshot (E4).

## Payload (общие поля)

Все envelope: `correlationId`, `hotelId`, `eventType`, `timestamp`, `payload`.

Folio-события дополнительно:

- `reservationId`, `folioId`, `folioType`
- `revenueCode`, `amount`, `qty`, `description`, `businessDate`
- `guestVoen`, `requiresEInvoicing` (для e-qaimə — см. чеклист §C5)
- `paymentMethod` (для payment / check-out)

## Настройки отеля (отключаемые каналы)

Хранение (план реализации): `HotelProfile.integrationSettingsJson` или env + override в UI **Admin → Integration**.

```json
{
  "outbound": {
    "enabled": true,
    "realtime": {
      "chargePosted": true,
      "paymentReceived": true,
      "chargeVoided": true,
      "reservationCompleted": true
    },
    "nightAuditClosed": true,
    "urls": {
      "default": "http://localhost:3000/api/integration/mock-receiver",
      "nightAudit": ""
    },
    "requireZeroBalanceOnCheckout": true
  }
}
```

| Ключ | Default | Смысл |
|------|---------|-------|
| `outbound.enabled` | `true` | Глобальный выключатель |
| `outbound.realtime.chargePosted` | `true` | E2 accrual при начислении |
| `outbound.realtime.paymentReceived` | `true` | E3 при оплате |
| `outbound.realtime.chargeVoided` | `true` | Сторно строки |
| `outbound.realtime.reservationCompleted` | `true` | Снимок при check-out |
| `outbound.nightAuditClosed` | `true` | E1 после night audit |

Если канал `false` — событие **не отправляется** (можно логировать `SKIPPED` в `OutboundEventLog`).

## Env (fallback до UI настроек)

| Variable | Назначение |
|----------|------------|
| `OUTBOUND_REALTIME_CHARGES` | `true`/`false` |
| `OUTBOUND_REALTIME_PAYMENTS` | `true`/`false` |
| `OUTBOUND_REALTIME_VOIDS` | `true`/`false` |
| `OUTBOUND_CHECKOUT_EVENT` | `true`/`false` |
| `OUTBOUND_NIGHT_AUDIT_EVENT` | `true`/`false` |

## Реализация в коде (статус)

| Событие | Статус |
|---------|--------|
| `RESERVATION_COMPLETED` | ✅ check-out |
| `NIGHT_AUDIT_CLOSED` | ✅ night audit |
| `FOLIO_CHARGE_POSTED` | ✅ folio postCharge |
| `FOLIO_PAYMENT_RECEIVED` | ✅ folio postPayment |
| `FOLIO_CHARGE_VOIDED` | ✅ folio voidCharge |
| Settings JSON + Admin UI | ✅ `/admin/integration` |

См. [`src/lib/integration/event-dispatcher.ts`](../../src/lib/integration/event-dispatcher.ts).

## Связь с Nafta / 1C

До готовности **ERA Finance**: mock-receiver + 1C bridge по тем же `eventType`.  
Отключение канала нужно отелю, у которого ERP принимает **только E1** — без переписывания кода.
