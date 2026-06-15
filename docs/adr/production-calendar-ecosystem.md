# ADR: Production calendar (AZ) — ecosystem contract

**Status:** Accepted  
**Date:** 2026-06-15

## Context

AZ production calendar was duplicated in `era-finance-core/hr/calendar/az-2026.ts` while `era-data-hub` owns `CalendarDay`. Hotel auto-BAR and industry SLA need `dayType` semantics beyond boolean `isWorking`.

## Decision

### Source of truth

**era-data-hub** → `CalendarDay` + `/registry/v1/calendar/az/*`.

### dayType taxonomy

| dayType | isWorking | Labor (HR/bank) | Hotel demand |
|---------|-----------|-------------------|--------------|
| `working` | true | normal | ×1.0 |
| `weekend` | false | off | premium |
| `holiday` | false | off | premium |
| `transferred_rest` | false | off | premium |
| `transferred_working` | true | normal | **premium** |
| `mourning` | false | off | **×1.0 freeze** |
| `shortened` | true | ends 13:00 policy | ×1.0 |

### Two consumption modes

| Mode | API | Consumers |
|------|-----|-----------|
| **Labor** | `isWorking`, `addBusinessDays` | finance HR, bank EOD/settlement, construction timesheets |
| **Demand** | `dayType` bulk `/days` | hotel auto-BAR batch (not runtime `quoteStay`) |

### Shared client

`packages/satellite-kit/src/integration/calendar.client.ts` — all satellites; NestJS apps align via `DataHubClientService` (finance/bank).

### Anti-patterns

- Per-app `az-2026.ts` hardcode
- Hotel calling hub on every `quoteStay()`
- Orchestrator billing using prod calendar (billing = calendar months Baku)

## Related

- [hotel-auto-pricing-production-calendar.md](./hotel-auto-pricing-production-calendar.md)
- [era-data-hub.md](./era-data-hub.md)
- [hotel-dynamic-rate-plans.md](./hotel-dynamic-rate-plans.md)
