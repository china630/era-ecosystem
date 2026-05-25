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
| POST | `/api/visits/:id/complete` | K-02 |
| POST | `/api/events/dispatch` | K-02 |

Event: `SATELLITE_CLINIC_VISIT_COMPLETED` — `visitId`, `patientRef`, `serviceCodes[]`, `amountNet` — [clinic.events.ts](../packages/era-contracts/src/events/clinic.events.ts).

## Finance boundary

Insurance billing, full patient billing — deferred to Finance MDM + AR. See [doc/clone-spec/01-finance-boundary.md](./doc/clone-spec/01-finance-boundary.md).
