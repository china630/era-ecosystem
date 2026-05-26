# ADR — Satellite ↔ Finance bridge pattern

**Status:** Accepted  
**Reference implementation:** [satellite_finance_gl_bridge.plan.md](../../.cursor/plans/satellite_finance_gl_bridge.plan.md) (Nafta NW-1, FIN-01)

## Context

Industry satellites emit operational events; Finance owns GL, AR, and master data. Some flows need **explicit mapping** from satellite domain codes to finance accounts before posting.

## Pattern (repeat for new bridges)

1. **Mapping table** in Finance or satellite DB (`{Domain}RevenueMapping`, `RevenueCode → accountCode`).
2. **Trigger** on satellite lifecycle milestone (night audit, trip complete, progress act approve).
3. **Event** with line breakdown (`SATELLITE_*` contract in `@era/contracts`).
4. **Finance worker** idempotent post (`correlation_id` = satellite entity id + period).
5. **Docs:** DELIVERY checkbox, PRD §4, TZ API row, UAT-SMOKE curl, `SMOKE_ALL_SERVICES.md` subsection.

## When to use

| Use bridge | Use event-only |
|------------|----------------|
| Daily revenue rollups to GL | Single sale with existing worker |
| Invoice center / agency ledger sync | CRM lead convert handoff |
| Contract pricing → rate plans | POD capture (ops only) |

## Child plans

Spawn `satellite_{domain}_finance_bridge.plan.md` when starting a new bridge increment; track in [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md) and app `doc/DELIVERY-*`.

## Examples in repo

| Bridge | Apps | Plan |
|--------|------|------|
| Hotel daily revenue → GL | hotel-pms, finance-core | `satellite_finance_gl_bridge` |
| Progress act → Finance | construction | event `SATELLITE_CONSTRUCTION_PROGRESS_APPROVED` (extend with mapping if needed) |
