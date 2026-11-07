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

1. DEPARTMENT + `revenueRouting=PARENT` → `REVENUE_EVENT` from each entitled industry sat on the dept → parent `finance_core` when parent has that entitlement. **No same-org self edge** in that case (one money recipient).
2. Otherwise (OWN / STANDALONE) → when this org has live `finance_core`, `REVENUE_EVENT` from each other entitled sat on this org → this org's `finance_core`.
3. Child industry sat in `{industry_clinic, industry_fnb_pos, industry_retail}` with hotel on parent/hub → `FOLIO_POST` and `SETTLEMENT` → parent/hub `industry_hotel_pms` when both sides entitled.

`READ_STATUS` is schema-ready; v1 creates no PLATFORM rows for it.

### Re-sync

Desired PLATFORM set is upserted. PLATFORM rows outside the desired set are **deleted**. `managedBy=ACCEPTOR` rows are never deleted or re-enabled by sync.

### Acceptor disable

Satellite staff may disable an **incoming** channel: first disable flips `managedBy` to `ACCEPTOR` and `enabled=false`. SuperAdmin may re-enable / reset to PLATFORM via admin API. Sender cannot enable a channel for themselves.

### Snapshot + gate

`/v1/subscription/me` (and Sync consumers) expose `channels[]`. Kit helpers `isChannelEnabled`, `checkChannelEnabledLive`, `assertRevenueEventChannelEnabled` (money publishes to `finance_core` only — not guest-status/stock). Wired bridges are **fail-closed** when the row is missing or `enabled=false`:

- Guest charge: F&B + retail + clinic `FOLIO_POST` / `SETTLEMENT`.
- Revenue spine: hotel night-audit / invoice / reservation completed / city-ledger snapshot / agency commission payable; clinic day-document money events (`VISIT` / `PROCEDURE` / `LAB_ORDER` / `WARD_DAY_CHARGE`); F&B sale/shift finance events; retail `SATELLITE_RETAIL_SALE_COMPLETED` + `SATELLITE_RETAIL_SHIFT_CLOSED`. PLATFORM edges also re-sync on satellite connect. F&B LOCAL_CASHIER pay and Z-close assert **before** ticket/shift mutation (post-close `void` publish stays best-effort). Retail asserts before PAID / return create / hub settlement-confirm / Z-close; skips the revenue event on hotel room-charge (FOLIO only). Clinic asserts before visit/procedure/lab COMPLETED (Finance path) and before hub visit settle-confirm when amount > 0; ward day charge asserts via dispatch before daily-charge row create.

F&B and retail `/api/edition` expose `folioPostEnabled` / `settlementEnabled` (fail-closed) so ops UI can hide the buttons.

UI may show code-only bridges as `CODE_LEGACY` (display only; never satisfies the gate).

### Screens

- SuperAdmin org hub: Channels block (in/out, toggle). Owner Control Home does **not** edit this graph.
- Satellite `/admin/links`: money routing read-only + outbound + inbound (ACCEPTOR toggle) on hotel, clinic, F&B, retail, auto, wholesale, logistics, construction, CRM.
- Finance `/admin/links` (Nest `GET/PATCH /api/integration/channels`): inbound spine acceptor surface.

## Consequences

- Operating mode remains the money SoR; channels are the peer-call policy edge.
- CP-COMMS-01 messaging inbox stays separate from CP-CHANNELS-01 (product v1 — not channels UI).

## Deferred debt (do not forget)

Recorded 2026-11-03. Tracked in [Platform-Sprint-Index](../acceptance/Platform-Sprint-Index.md) (`S-CHANNELS-*`).

| Debt | Notes |
|------|--------|
| Auto folio/settlement PLATFORM rows | Do not add `industry_auto_service` to hotel bridge list until an auto room-charge call exists. CODE_LEGACY hint shown on shared links. |
| `OPS_HANDOFF` call-site gate | Enum + wholesale→retail PLATFORM desired edges landed 2026-11-05; `assertChannelEnabled` waits first S2S client. |
| `READ_STATUS` PLATFORM rows + consumers | Schema-ready; v1 creates none. |
| UI `CODE_LEGACY` display | Kit `CHANNEL_LEGACY_HINTS` + shared links section (display-only). |
| Messaging Comms Hub (`CP-COMMS-01`) | Separate product — see [cp-comms-hub-messaging.md](./cp-comms-hub-messaging.md). |
| UAT-SMOKE → SHOW / SHIPPED | Lab partial (`reports/platform-channels-harden-signoff.md`); human UI walk still open. |
