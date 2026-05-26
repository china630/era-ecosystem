# ERA Clinic — Technical specification (TZ)

Product requirements: [PRD.md](./PRD.md). Delivery tracker: [doc/DELIVERY-CLINIC.md](./doc/DELIVERY-CLINIC.md).

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Next.js 15, Prisma 6, PostgreSQL `era_clinic` |
| Port | 3306 · Host `clinic.era.az` |
| Entitlement | `industry_clinic` |

## Data model (K1 target)

```text
Tenant → Practitioner → Room → Appointment → Visit → VisitServiceLine
```

## API surface (planned)

| Method | Path | PRD |
|--------|------|-----|
| GET/POST | `/api/appointments` | K-01 |
| POST | `/api/visits/:id/complete` | K-04 |
| POST | `/api/visits/:id/discount` | K-13 |
| GET/POST | `/api/lab-orders` | K-06 |
| POST | `/api/lab-orders/:id/collect` | K-08 |
| POST | `/api/lab-orders/:id/results` | K-09 |
| POST | `/api/lab-orders/:id/publish` | K-10 |
| POST | `/api/lab-orders/:id/complete` | K-11 |
| GET | `/api/scheduling/slots` | K-05 |
| GET | `/api/executive/summary` | K-14 |
| POST | `/api/events/dispatch` | platform |

Event: `SATELLITE_CLINIC_VISIT_COMPLETED` — `visitId`, `patientRef`, `serviceCodes[]`, `amountNet` — [clinic.events.ts](../packages/era-contracts/src/events/clinic.events.ts).

Event: `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` — `labOrderId`, `visitId?`, `patientRef`, `testCodes[]`, `amountNet`.

## LabOrder fields (K2)

| Field | Type | Story |
|-------|------|-------|
| `visitId` | String? | K-06 link to visit |
| `collectedAt` | DateTime? | K-08 |
| `resultJson` | String? | K-09 |
| `publishedAt` | DateTime? | K-10 |
| `status` | enum | ORDERED → COLLECTED → RESULT_READY → PUBLISHED → COMPLETED |

## VisitDiscountAudit (K3)

| Field | Type |
|-------|------|
| `visitId` | String |
| `percent` | Decimal |
| `approvedBy` | String (user id) |
| `reason` | String |

## W1-E — Enrichment

| Method | Path | Model |
|--------|------|-------|
| GET | `/api/catalog/services` | `ServiceCatalogCache` (code, name, priceNet) |
| POST | `/api/catalog/sync` | Seed/sync price list stub (M6) |
| POST | `/api/lab-orders/:id/results` | `resultJson` lines with `flag: CRITICAL` (M5) |
| GET | `/api/lab-orders?criticalOnly=true` | Filter orders with critical results |

## Finance boundary

Insurance billing, full patient billing — deferred to Finance MDM + AR. See [doc/clone-spec/01-finance-boundary.md](./doc/clone-spec/01-finance-boundary.md).
