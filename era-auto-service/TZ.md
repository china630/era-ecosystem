# ERA Auto STO — Technical specification (TZ)

Product requirements: [PRD.md](./PRD.md). Delivery tracker: [doc/DELIVERY-AUTO.md](./doc/DELIVERY-AUTO.md).

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Next.js 15, Prisma 6, PostgreSQL `era_auto_service` |
| Port | 3304 · Host `auto-service.era-365.online` |
| Entitlement | `industry_auto_service` |
| Packages | `@era/contracts`, `@era/satellite-kit` |

## Data model

```text
CustomerVehicle → WorkOrder → WorkOrderLaborLine | WorkOrderPartLine
Bay → Appointment (optional link to WorkOrder)
```

## API surface

| Method | Path | PRD |
|--------|------|-----|
| GET/POST | `/api/vehicles` | M1 customer card |
| GET/POST | `/api/work-orders` | A-01 |
| GET/POST | `/api/work-orders/:id/labor-lines` | M3 |
| GET/POST | `/api/work-orders/:id/part-lines` | M4 |
| POST | `/api/work-orders/:id/complete` | A-02 (recalc totals) |
| POST | `/api/events/dispatch` | A-02 |

Event: `SATELLITE_AUTO_WORK_ORDER_COMPLETED` — `workOrderId`, `laborAmount`, `partsAmount` — [auto-sto.events.ts](../packages/era-contracts/src/events/auto-sto.events.ts).

## Finance boundary

Parts stock and supplier AP — Finance inventory/AP. Satellite sends revenue recognition event only. See [doc/clone-spec/01-finance-boundary.md](./doc/clone-spec/01-finance-boundary.md).
