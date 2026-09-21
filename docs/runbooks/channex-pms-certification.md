# Channex PMS certification (ERA Hotel Channel Manager)

**ADR:** [hotel-channel-manager-pack.md](../adr/hotel-channel-manager-pack.md)  
**Coverage:** `HOT-CH-02` stays **STUB** until this runbook is completed with live UAT evidence.

## Prerequisites

1. Staging self-serve: https://staging.channex.io — create test property + API key.
2. Super-Admin → `/super-admin/vendors/channex` — paste partner API key; keep **staging** base until certified. Do **not** set hotel `ERA_CHANNEX_PMS_CERTIFIED`.
3. Hotel org entitled to `hotel_distribution` (39 AZN Channel Manager pack).
4. Hotel `/distribution/channel` binding: `provider=channex`, `channexPropertyId`, room/rate mappings, `live=false`.

## Staging UAT (W7)

1. Map ERA room types / rate plans to Channex ids on channel mappings.
2. Push availability → `ChannelAriJob` PENDING → cron `POST /api/cron/channel-ari-drain`.
3. Create a test OTA booking in Channex staging → webhook `POST /api/integrations/channex/webhook` with `x-channex-webhook-secret` and `{ event, payload: { property_id, booking_id, revision_id } }` → PMS pulls revision, upserts FO reservation, acks.
4. Direct IBE: publishable key → search → hold → book → ARI enqueue.
5. Record evidence in UAT-SMOKE §29 steps 6–8.

## Certification (W8)

1. Complete Channex [PMS certification tests](https://docs.channex.io/api-v.1-documentation/pms-certification-tests) once for ERA.
2. Super-Admin Channex vendor page → **Use production base** (`https://app.channex.io/api/v1`) and check **PMS certified**.
4. Per hotel: set binding `live=true` only when mappings + property id + webhook secret ready. Staging orgs never drain against production base.
5. Confirm no dual-push: binding provider stays `channex` (never enable booking_com/expedia beside it).
6. Live UAT evidence → then bump `HOT-CH-02` to SHIPPED and Product-Readiness CM layer.

## Cost note

Channex invoices are **ERA company COGS** (USD 7 / live hotel-type property). Not a satellite meter.
