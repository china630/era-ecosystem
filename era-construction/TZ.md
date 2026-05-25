# ERA Construction — Technical specification (TZ)

Product requirements: [PRD.md](./PRD.md). Delivery tracker: [doc/DELIVERY-CONSTRUCTION.md](./doc/DELIVERY-CONSTRUCTION.md).

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node 20+, Next.js 15 App Router |
| DB | PostgreSQL `era_construction` |
| ORM | Prisma 6 |
| Auth | `@era/satellite-kit` |
| Events | `@era/contracts` → `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED` |
| UI | `@era/satellite-kit/ui` |

## Deployment

| Param | Value |
|-------|-------|
| Port | 3302 |
| Host | `construction.era.az` |
| Entitlement | `industry_construction` |

## Data model (C1 target)

```text
Tenant → Project → BoqSection → ProgressAct → ActLine
```

## API surface (planned)

| Method | Path | PRD |
|--------|------|-----|
| GET/POST | `/api/projects` | C-01 |
| POST | `/api/projects/:id/acts` | C-03 |
| POST | `/api/acts/:id/approve` | C-03 → progress act event |
| POST | `/api/events/dispatch` | platform |

Payload: `projectId`, `actId`, `amountNet`, `currency: AZN` — [construction.events.ts](../packages/era-contracts/src/events/construction.events.ts).

## Finance boundary

Procurement, subcontractor invoices, WIP journals — **era-finance-core**. See [doc/clone-spec/01-finance-boundary.md](./doc/clone-spec/01-finance-boundary.md).
