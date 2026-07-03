# ADR: FX rates (CBAR) — ecosystem contract

**Status:** Accepted  
**Date:** 2026-06-15

## Context

CBAR official FX rates were partially duplicated in `era-finance-core` (direct cbar.az fetch + local `CbarOfficialRate`) while `era-data-hub` owns the registry API. Bank-core used hardcoded fallbacks. Industry satellites must not call hub directly.

## Decision

### Source of truth

| Layer | Role |
|-------|------|
| **era-data-hub** | Ingest CBAR XML when `ERA_DATA_HUB_DATA_SOURCE=hub`; serve `/registry/v1/fx/*` |
| **era-finance-core** | Strict accounting conversion, revaluation, customs `currencyRate`, holdings dashboard |
| **era-bank-core** | Dated FINAL rates for EOD/treasury |
| **Industry satellites** | Read-only display via Orchestrator `GET /platform/v1/catalog/fx/convert` (`platformFxConvert` / deprecated alias `financeFxPreview` in satellite-kit) — [orchestrator-platform-integration-gateway.md](./orchestrator-platform-integration-gateway.md) |

### Two consumption modes

| Mode | API | Consumers | Rules |
|------|-----|-----------|-------|
| **Strict accounting** | `GET /fx/rates?date=` FINAL | Revaluation, customs BGD, bank EOD | Exact Baku date; fail if no FINAL |
| **Operational convert** | `GET /fx/convert` | Dashboard, logistics preview | PRELIMINARY acceptable before ~10:00 Baku; label `isFallback` |

### Anti-patterns

- Industry satellites calling `/registry/v1/fx/*`, `ERA_DATA_HUB_URL`, or Finance `ERA_FINANCE_API_*` for display convert
- Industry satellites calling cbar.az directly
- Finance CBAR ingest when hub owns ingest (`ERA_DATA_HUB_FINANCE_CBAR_INGEST_DISABLED=true`)
- Silent `1.7` FX fallback in bank-core production paths

### Customs chain

```
Foreign invoice → hub CBAR on bgdDate → statisticalValueAzn → hub HS tariff → duty/VAT
```

Finance `CustomsService.createFullDraftFromCapture` auto-fills `currencyRate` from hub when missing.

## Implementation

- Types: `packages/era-contracts/src/reference-data/fx.ts`
- Client: `packages/satellite-kit/src/integration/fx-rate.client.ts`
- Finance: `DataHubClientService`, `CbarRateSyncService.getFinalOfficialAznPerUnit`, `CurrencyConverterService`
- Bank: `era-bank-core/apps/api/src/integration/data-hub.client.ts`

## Consequences

- Local dev requires hub + token OR finance local DB cache for FX
- On-prem bank uses `packages/ref-data-snapshot/snapshot.json` with dated `fxRates[]`

## Related

- [orchestrator-platform-integration-gateway.md](./orchestrator-platform-integration-gateway.md)
- [era-data-hub.md](./era-data-hub.md)
- [era-data-hub/doc/DATA-HUB-CONSUMER.md](../../era-data-hub/doc/DATA-HUB-CONSUMER.md)
- Finance TZ §28 FEAT-FC-DH-001
