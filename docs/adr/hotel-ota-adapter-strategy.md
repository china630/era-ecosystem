# ADR: Hotel OTA adapter strategy

**Status:** Accepted  
**Date:** 2026-06-13  
**Related:** [era-hotel-pms/doc/clone-spec/06-channel-crm-med.md](../../era-hotel-pms/doc/clone-spec/06-channel-crm-med.md) · [BACKLOG-PRODUCTION.md](../../era-hotel-pms/doc/BACKLOG-PRODUCTION.md)

## Context

Nafta (and AZ market hotels) use **Elektraweb built-in Channel Manager** with OTA connections (Booking.com, Expedia, Exely) via **ElektraSync** (screens WA0068, WA0127, WA0253). ERA Hotel PMS has operational CM UI (availability matrix, mappings, stop-sell, sync error journal) but **no live push/pull** — only `POST /api/integrations/ota/:channel` stub.

Nafta UAT requires **live OTA** in phase 1 (not import-only).

## Discovery checklist (Nafta audit)

| # | Question | Why |
|---|----------|-----|
| 1 | Which channels are **active** in WA0068? | Prioritize first adapter |
| 2 | Booking.com: **direct Connectivity API** or via **Exely hub**? | Adapter target |
| 3 | Exely: separate property account credentials? | Env vars |
| 4 | Who owns rate/quota push (revenue vs reception)? | RBAC on `/channel` |
| 5 | Inbound reservation format (XML/JSON/webhook URL)? | Ingest mapper |

**Working assumption until audit confirms:** Nafta uses **Booking.com + Expedia** through Elektraweb CM; Exely is listed as AZ/CIS hub — **first ERA adapter = normalized webhook + Exely-shaped HTTP client** behind `ERA_CHANNEL_ADAPTER=webhook|exely|stub`.

## Decision

1. **`ChannelAdapter` interface** in `era-hotel-pms/src/lib/channel/adapters/` — pluggable push/pull.
2. **Registry** resolves adapter from `ERA_CHANNEL_ADAPTER` (default `webhook` for UAT bridge; `stub` for local dev).
3. **Inbound:** extend OTA webhook → `upsertOtaReservation()` idempotent on `externalRef`.
4. **Outbound:** `pushChannelAvailability()` reads existing availability matrix + room/rate mappings.
5. **Observability:** reuse `ChannelSyncError` journal; no silent failures.
6. **Do not** replicate ElektraSync proprietary protocol without vendor docs — use **Exely/Booking official APIs** once Nafta credentials are known.

## Adapter matrix (target)

| Adapter | Mode | UAT role |
|---------|------|----------|
| `stub` | ack only | Local dev |
| `webhook` | normalized JSON ingest + availability push log | Bridge / middleware |
| `exely` | HTTP client when `EXELY_*` env set | Production AZ hub |

## Consequences

- CM UI investment (Wave B) is preserved; live sync is adapter layer only.
- Switching from Elektraweb CM → ERA CM = re-point OTA credentials to ERA webhook/Exely client.
- Full Booking Connectivity certification is **post-UAT** if direct API required.
