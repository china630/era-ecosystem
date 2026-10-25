# ADR: Reference data ecosystem (era-data-hub)

## Status

Accepted — 2026-06-15

## Context

Global read-only catalogs (FX, calendar, HS, banks, VÖEN directory, geo, UoM, tax, CoA templates) must have a single system of record. Finance and bank-core are primary consumers; industry satellites must not duplicate ingest or call hub directly.

## Decision

1. **SoR:** `era-data-hub` `/registry/v1/*` always reads `era_data_hub`. External fetch is per catalog in hub settings (super-admin `/super-admin/reference`).
2. **Consumers:** finance and satellites either read the hub, or keep an org-local Excel copy. Excel does not write the shared hub. `referenceSource` is `hub` | `excel` on the organization and is pushed with runtime-config.
3. **Industry rule (updated 2026-06-16):** industry satellites **must not** call `era-data-hub` or `era-finance-core` for **sync global catalog reads** (calendar, FX display convert, VÖEN directory). Use **Orchestrator Platform Gateway** `GET /platform/v1/catalog/*` via `@era/satellite-kit` — see [orchestrator-platform-integration-gateway.md](./orchestrator-platform-integration-gateway.md). HS tariff preview and tenant counterparty operations remain Finance-only.
3a. **Countries (debt, 2026-10-17):** hub `Country`/`City` remains geo SoR. The gateway does not yet expose `/platform/v1/catalog/countries`. Until it does, `@era/satellite-kit` ships a static ISO az/en/ru table and `countryLabel`; hotel/clinic only re-export that helper. This is a temporary kit bypass, not a hotel domain catalog. When the gateway lands, kit caches the same three locales and satellites keep calling `countryLabel`.
4. **Split from MDM:** natural/legal person identity lives in orchestrator `era_mdm`, not data-hub. VÖEN **company directory** in hub ≠ MDM person registry.
5. **Tenant data stays in finance:** org `Account`, counterparty cards, customs declarations, bank accounts per org.

**Legacy (pre–Wave 2):** Finance API handoffs (`financeFxPreview`, `financeVoenLookup`) and direct hub via `calendar.client.ts` — **deprecated** for industry; removal tracked in Wave 2.

## Consumer matrix

| Consumer | Auth | Catalogs |
|----------|------|----------|
| era-finance-core | `DATA_HUB_SERVICE_TOKEN` | All P1 |
| era-bank-core | same + on-prem snapshot | FX, calendar, banks, CoA subset |
| Industry | Orchestrator `SATELLITE_EVENT_SERVICE_TOKEN` | Platform gateway `/platform/v1/catalog/*` only |
| era-orchestrator | `DATA_HUB_SERVICE_TOKEN` (backend proxy) | Hub proxy for gateway |
| External B2B | `X-Api-Key` via orchestrator | Metered read |

## Related

- [orchestrator-platform-integration-gateway.md](./orchestrator-platform-integration-gateway.md)
- [era-data-hub.md](./era-data-hub.md)
- [fx-rates-ecosystem.md](./fx-rates-ecosystem.md)
- [production-calendar-ecosystem.md](./production-calendar-ecosystem.md)
- [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md)
- [managed-lists-vs-enums.md](./managed-lists-vs-enums.md) — tenant/platform **operational** pick-lists vs Prisma enums (Wave A/B); does not replace hub SoR for FX/calendar/VÖEN
- Audit: [REFERENCE_DATA_CONSUMER_AUDIT.md](../REFERENCE_DATA_CONSUMER_AUDIT.md)
