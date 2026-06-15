# ADR: Reference data ecosystem (era-data-hub)

## Status

Accepted — 2026-06-15

## Context

Global read-only catalogs (FX, calendar, HS, banks, VÖEN directory, geo, UoM, tax, CoA templates) must have a single system of record. Finance and bank-core are primary consumers; industry satellites must not duplicate ingest or call hub directly.

## Decision

1. **SoR:** `era-data-hub` `/registry/v1/*` when `ERA_DATA_HUB_DATA_SOURCE=hub`.
2. **Expand/contract:** hub owns ingest → finance read-through + fallback → disable finance duplicate cron/seeds.
3. **Industry rule:** no `ERA_DATA_HUB_*` or `/registry/v1` in `era-logistics`, `era-hotel-pms`, etc. Use Finance API handoffs (`financeFxPreview`, `financeHsTariffPreview`, `financeVoenLookup`) or deep links.
4. **Split from MDM:** natural/legal person identity lives in orchestrator `era_mdm`, not data-hub. VÖEN **company directory** in hub ≠ MDM person registry.
5. **Tenant data stays in finance:** org `Account`, counterparty cards, customs declarations, bank accounts per org.

## Consumer matrix

| Consumer | Auth | Catalogs |
|----------|------|----------|
| era-finance-core | `DATA_HUB_SERVICE_TOKEN` | All P1 |
| era-bank-core | same + on-prem snapshot | FX, calendar, banks, CoA subset |
| Industry | Finance Bearer / session | Handoffs only |
| External B2B | `X-Api-Key` via orchestrator | Metered read |

## Related

- [era-data-hub.md](./era-data-hub.md)
- [fx-rates-ecosystem.md](./fx-rates-ecosystem.md)
- [production-calendar-ecosystem.md](./production-calendar-ecosystem.md)
- [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md)
- Audit: [REFERENCE_DATA_CONSUMER_AUDIT.md](../REFERENCE_DATA_CONSUMER_AUDIT.md)
