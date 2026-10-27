# ADR: Satellite peer URL resolution (S2S, not env SoR)

**Status:** Accepted — 2026-10-27  
**Scope:** Orchestrator `SatelliteEndpoint` + `@era/satellite-kit` resolve helper; Finance → Hotel city-ledger payment callbacks; Clinic / F&B / Retail → Hotel bridges

## Context

Cross-satellite HTTP (Finance `payment-applied`, Clinic room-charge, F&B/Retail PMS bridge) used process env (`ERA_HOTEL_PMS_INTERNAL_URL`, `HOTEL_PMS_URL`). Same `organizationId` does not imply a shared process — callers need a routable base URL. Env as SoR breaks SHARED (one Finance, many hotel endpoints), compose hairpin (public HTTPS vs `http://hotel-pms:3201`), and morning boots when a variable is missing.

Owner launch already resolves via `GET /v1/satellites/launch-url` + `SatelliteEndpointRegistryService`. In-cluster fan-out already swaps public trap URLs for `HOTEL_PMS_API_URL` / similar.

## Decision

1. **SoR** for peer S2S base URL = orchestrator `SatelliteEndpoint` for `(organizationId, satelliteKey)`, resolved with the same hairpin rules as fan-out (`resolveEndpoint`).
2. **S2S API:** `GET /v1/internal/satellites/peer-endpoint?satelliteKey=` with Bearer service token + `X-Organization-Id` → `{ baseUrl, satelliteKey, source: "registry" | "env_fallback" }` (no secrets in the body for callers that use the cluster event token separately).
3. **Kit:** `resolvePeerSatelliteBaseUrl({ organizationId, satelliteKey })` calls that API via `resolveOrchestratorBaseUrl` + `resolveSatelliteEventServiceToken`. Short TTL memory cache. Production fail-closed if unresolved unless `ERA_PEER_URL_ENV_FALLBACK=1` (or non-production), then legacy env list as bootstrap only.
4. **Finance city ledger payment sync (hybrid):**
   - Immediate best-effort `POST {hotel}/api/internal/v1/city-ledger/payment-applied` on allocate **and** bank match when `invoice.sourceFolioId` is set.
   - Durable `HotelPaymentCallbackOutbox` + cron retry.
   - Reconcile cron: PAID/partial hotel-sourced invoices → enqueue missing callbacks.
   - Night audit may soft-warn on drift later; not the only channel; not fail-closed.
5. **Do not** put hotel URL in Finance/Clinic org settings UI. Token remains cluster Sync/runtime-config, not a cashier setting.
6. **Deprecate** `ERA_HOTEL_PMS_INTERNAL_URL` / caller `HOTEL_PMS_URL` as production SoR; keep as local fallback only.

## Consequences

- Lab/Sync must keep enabled `SatelliteEndpoint` rows with **in-cluster** base URLs for Docker S2S.
- Env purge is a follow-up after UAT; one-release dual-read is intentional.
- Clinic/F&B/Retail/kit revenue catalog share the same helper.

## Related

- [satellite-organization-bind.md](./satellite-organization-bind.md)  
- [hotel-city-ledger-and-fo-money.md](./hotel-city-ledger-and-fo-money.md)  
- [ECOSYSTEM_URLS.md](../ECOSYSTEM_URLS.md) · [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md)
