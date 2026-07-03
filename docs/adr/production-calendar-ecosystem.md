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

| Consumer | Client path |
|----------|-------------|
| **Industry satellites** | `packages/satellite-kit` → Orchestrator `GET /platform/v1/catalog/calendar/*` ([orchestrator-platform-integration-gateway.md](./orchestrator-platform-integration-gateway.md)) |
| **era-finance-core, era-bank-core** | `DataHubClientService` → hub `/registry/v1/calendar/*` directly |

Legacy: `calendar.client.ts` calling `ERA_DATA_HUB_URL` from industry — **deprecated** (Wave 2).

### Anti-patterns

- Per-app `az-2026.ts` hardcode
- Industry apps setting `ERA_DATA_HUB_*` or calling `/registry/v1/calendar/*` directly
- Hotel calling hub on every `quoteStay()` (batch warmYear only)
- Orchestrator billing using prod calendar (billing = calendar months Baku)

## Related

- [orchestrator-platform-integration-gateway.md](./orchestrator-platform-integration-gateway.md)
- [hotel-auto-pricing-production-calendar.md](./hotel-auto-pricing-production-calendar.md)
- [era-data-hub.md](./era-data-hub.md)
- [hotel-dynamic-rate-plans.md](./hotel-dynamic-rate-plans.md)
