# ERA Clinic — Technical specification (TZ)

Product requirements: [PRD.md](./PRD.md). Delivery tracker: [doc/DELIVERY-CLINIC.md](./doc/DELIVERY-CLINIC.md). Architecture: [doc/ARCHITECTURE.md](./doc/ARCHITECTURE.md). Full plan: [doc/CLINIC-FULL-IMPLEMENTATION-PLAN.md](./doc/CLINIC-FULL-IMPLEMENTATION-PLAN.md).

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Next.js 15, Prisma 6, PostgreSQL `era_clinic` |
| Port | 3306 · Host `clinic.era-365.online` |
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
| GET | `/api/appointments/calendar` | K-05 / CLI-05 practitioner day matrix |
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

## Product APIs (v1.0)

| Method | Path | Model |
|--------|------|-------|
| GET | `/api/catalog/services` | `ServiceCatalogCache` (code, name, priceNet) |
| POST | `/api/catalog/sync` | Seed/sync price list stub (M6) |
| POST | `/api/lab-orders/:id/results` | `resultJson` lines with `flag: CRITICAL` (M5) |
| GET | `/api/lab-orders?criticalOnly=true` | Filter orders with critical results |

## Scheduling time layers (sanatorium)

Canon: [docs/adr/clinic-scheduling-time-layers.md](../docs/adr/clinic-scheduling-time-layers.md).

| Layer | Target field | Today |
|-------|----------------|-------|
| Occupancy (guest in cabin, 5-min grid) | `ProcedureType.durationMin` | Shipped |
| Resource gap (cabin idle after occupancy; **0 allowed**) | `ProcedureType.resourceGapMinutes` | Shipped — default 5; tenant field = default-on-create |
| Patient rest (this guest, next any procedure) | `ProcedureType.patientRestMinutes` | Shipped — default 15 |
| Pair gap | `ProcedureRule.minGapMinutes` | Shipped, barely seeded |

Nafta UFF gel (`SVC-ULTRAFONOFOREZ-GEL`, cabin 17): occupancy **5**, resource gap **0**, patient rest **15**. Oil remains `SVC-ULTRAFONOFOREZ` 10/5/15. Do not set tenant gap to 0.

SOFT staff (CLI-30) does not inherit resource gap; HARD staff is exclusive on `[startsAt, endsAt)` only.

## Finance boundary

Insurance billing, full patient billing — deferred to Finance MDM + AR. See [doc/clone-spec/01-finance-boundary.md](./doc/clone-spec/01-finance-boundary.md).
