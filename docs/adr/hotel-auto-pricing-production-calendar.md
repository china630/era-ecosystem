# ADR: Hotel auto-BAR from production calendar

**Status:** Accepted  
**Date:** 2026-06-15

## Context

Hotel BAR (`RoomTypeRate`) is manually edited. Production calendar drives demand pricing on weekends/holidays/transferred working days; mourning days must not apply premium.

## Decision

### Rule

```
demandPremium(dayType) =
  mourning → 1.0
  weekend | holiday | transferred_rest | transferred_working → configuredPremium (default 1.5)
  else → 1.0
```

BAR cell: `amount = base × demandPremium(dayType)`; `source=AUTO` from nightly job.

### MANUAL lock

`RoomTypeRate.source=MANUAL` + `lockedAt` — auto-job skips overwrite.

### Runtime vs batch

- **Batch:** `auto-bar-engine.service.ts` + `POST /api/cron/auto-bar` warm hub year via bulk `/days`
- **Runtime:** `quoteStay()` unchanged — reads materialized `RoomTypeRate` only

### Payroll

Hotel staff payroll stays in **era-finance-core HR** — hotel-pms does not store prod calendar.

## Implementation

- `era-hotel-pms/src/lib/services/auto-bar-engine.service.ts`
- `GET/POST /api/admin/auto-bar` preview/apply
- Env: `HOTEL_AUTO_BAR_DEMAND_PREMIUM`, `ERA_DATA_HUB_*`

## Related

- [production-calendar-ecosystem.md](./production-calendar-ecosystem.md)
- [hotel-dynamic-rate-plans.md](./hotel-dynamic-rate-plans.md)
