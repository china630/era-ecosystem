# 19. Satellite bridge event (era-hotel-pms code)

> Реализация в репозитории: `src/lib/integration/event-dispatcher.ts`  
> Связь с ERP-контрактом: [18-erp-integration.md](18-erp-integration.md)

## Событие

| Поле | Значение |
|------|----------|
| `eventType` | `SATELLITE_HOTEL_RESERVATION_COMPLETED` |
| Триггер | Успешный check-out (`POST /api/reservations/:id/check-out`) |
| Транспорт | `HTTPS POST` → `EXTERNAL_INTEGRATION_URL` |

## Envelope (отправляется наружу)

```json
{
  "correlationId": "uuid",
  "hotelId": "NAFTA-SANATORIUM-001",
  "eventType": "SATELLITE_HOTEL_RESERVATION_COMPLETED",
  "timestamp": "2026-05-20T12:00:00.000Z",
  "payload": {
    "reservationId": "...",
    "guestName": "...",
    "guestVoen": null,
    "amountNet": 540,
    "currency": "AZN",
    "paymentMethod": "CARD",
    "breakdown": [
      { "itemType": "ACCOMMODATION", "sku": "ROOM-101", "qty": 3, "price": 120 },
      { "itemType": "RESTAURANT", "sku": "extra-uuid", "qty": 2, "price": 45 }
    ]
  }
}
```

**Без** accounting terms: нет счетов, дебета/кредита, GL.

## Mapping → логический контракт ERP (18)

| Satellite | ERP (логически) |
|-----------|-----------------|
| `SATELLITE_HOTEL_RESERVATION_COMPLETED` | **E3** `payment_received` + строки для **E2** invoice |
| `payload.breakdown[]` | Строки выручки по кодам (маппинг в bridge) |
| `guestVoen` | `counterparty_tax_id` для B2B |
| `paymentMethod` | Способ оплаты в ERP |
| `correlationId` | Идемпотентность (§18.4) |
| `hotelId` | `property_code` |

## Получатели

| Проект | `EXTERNAL_INTEGRATION_URL` |
|--------|----------------------------|
| Nafta | Custom 1C bridge listener |
| ERA ecosystem | Central API gateway |
| Local dev | `/api/integration/mock-receiver` |

## Отказоустойчивость

- Retry: `EXTERNAL_RETRY_MAX` (default 3), exponential backoff  
- Fallback: `logs/failed-events.log`  
- DB: `OutboundEventLog` (PENDING / SENT / FAILED)  
- Check-out **не откатывается** при сбое сети
