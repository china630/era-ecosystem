# ADR: Satellite integration channels

**Status:** Accepted  
**Date:** 2026-11-03  
**Product:** Control plane (`era-orchestrator`) + industry satellites  
**Related:** [org-operating-mode.md](./org-operating-mode.md) · [satellite-peer-url-resolution.md](./satellite-peer-url-resolution.md) · [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md) · [control-home-ia.md](./control-home-ia.md) · [commercial-topology-and-suspend.md](./commercial-topology-and-suspend.md)

## Context

Cross-satellite money and folio bridges (clinic/F&B/retail → hotel; department → parent Finance) are enforced only in code today. Operators cannot see or disable a path without changing operating mode. Messaging "Comms Hub" (`/workspace/comms-hub`) is a different product (CP-COMMS-01 stub) and must not host this graph.

## Decision

### One table (orchestrator DB)

`OrganizationSatelliteChannel`:

| Field | Meaning |
|-------|---------|
| `fromOrgId` + `fromSatelliteKey` | Sender |
| `toOrgId` + `toSatelliteKey` | Acceptor |
| `kind` | `FOLIO_POST` \| `SETTLEMENT` \| `REVENUE_EVENT` \| `READ_STATUS` |
| `enabled` | On / off |
| `managedBy` | `PLATFORM` \| `ACCEPTOR` |

Unique on the five identity fields. **No URL or token columns** — executors keep using `resolvePeerSatelliteBaseUrl`.

### PLATFORM allowlist (auto on operating-mode save)

1. DEPARTMENT + `revenueRouting=PARENT` → `REVENUE_EVENT` from each entitled industry sat on the dept → parent `finance_core` when parent has that entitlement.
2. Child industry sat in `{industry_clinic, industry_fnb_pos, industry_retail}` with hotel on parent/hub → `FOLIO_POST` and `SETTLEMENT` → parent/hub `industry_hotel_pms` when both sides entitled.

`READ_STATUS` is schema-ready; v1 creates no PLATFORM rows for it.

### Re-sync

Desired PLATFORM set is upserted. PLATFORM rows outside the desired set are **deleted**. `managedBy=ACCEPTOR` rows are never deleted or re-enabled by sync.

### Acceptor disable

Satellite staff may disable an **incoming** channel: first disable flips `managedBy` to `ACCEPTOR` and `enabled=false`. SuperAdmin may re-enable / reset to PLATFORM via admin API. Sender cannot enable a channel for themselves.

### Snapshot + gate

`/v1/subscription/me` (and Sync consumers) expose `channels[]`. Kit helper `isChannelEnabled`. Until bridge call sites are wired, bridges stay fail-open. Wired bridges (F&B room charge `FOLIO_POST`; F&B defer-to-hub `SETTLEMENT`; clinic settlement `SETTLEMENT`; clinic folio `FOLIO_POST`) are **fail-closed** when the row is missing or `enabled=false`. F&B `/api/edition` exposes `folioPostEnabled` / `settlementEnabled` (fail-closed) so ops UI can hide the buttons.

UI may show code-only bridges as `CODE_LEGACY` (display only; never satisfies the gate).

### Screens

- SuperAdmin org hub: Channels block (in/out, toggle). Owner Control Home does **not** edit this graph.
- Satellite `/admin/links`: money routing read-only + outbound + inbound (ACCEPTOR toggle).

## Consequences

- Operating mode remains the money SoR; channels are the peer-call policy edge.
- CP-COMMS-01 messaging stub stays separate from CP-CHANNELS-01.

## Deferred debt (do not forget)

Recorded 2026-11-03. Tracked in [Platform-Sprint-Index](../acceptance/Platform-Sprint-Index.md) (`S-CHANNELS-*`).

| Debt | Notes |
|------|--------|
| `/admin/links` on retail, finance, auto (+ other sats as bridges appear) | Hotel + clinic + F&B landed. Empty sat without hotel bridge may show money mode only. |
| Retail → hotel fail-closed gates | PLATFORM already creates FOLIO/SETTLEMENT for `industry_retail`; retail call sites still fail-open until wired. |
| `REVENUE_EVENT` gate on finance dispatch | PLATFORM creates parent-finance edges; event publishers still fail-open. |
| `READ_STATUS` PLATFORM rows + consumers | Schema-ready; v1 creates none. |
| UI `CODE_LEGACY` display | ADR allows showing pre-channel code bridges as display-only; not implemented. |
| Messaging Comms Hub (`CP-COMMS-01`) | Separate product from channels; `/workspace/comms-hub` stays stub. |
| UAT-SMOKE → SHOW / SHIPPED | Channels stay SCREEN / API until UI smoke on SA + sat links + bridge off. |
