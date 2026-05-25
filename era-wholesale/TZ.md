# ERA Wholesale — Technical specification (TZ)

Product requirements: [PRD.md](./PRD.md). Delivery tracker: [doc/DELIVERY-WHOLESALE.md](./doc/DELIVERY-WHOLESALE.md).

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Next.js 15, Prisma 6, PostgreSQL `era_wholesale` |
| Port | 3305 · Host `wholesale.era.az` |
| Entitlement | `industry_wholesale` |

## Data model (W1 target)

```text
Tenant → BuyerAccount (finance counterparty ref) → B2BOrder → OrderLine → Shipment
```

## API surface (planned)

| Method | Path | PRD |
|--------|------|-----|
| GET/POST | `/api/orders` | W-01 |
| POST | `/api/orders/:id/confirm-shipment` | W-02 |
| GET | `/api/buyers/:id/credit-limit` | W-03 (read Finance) |
| POST | `/api/events/dispatch` | W-02 |

Event: `SATELLITE_WHOLESALE_ORDER_CONFIRMED` — `orderId`, `buyerCounterpartyId`, `amountNet`, `lineCount` — [wholesale.events.ts](../packages/era-contracts/src/events/wholesale.events.ts).

## Finance boundary

Stock reservation, pick/pack, AR invoice — Finance. Satellite confirms commercial order + shipment trigger.
