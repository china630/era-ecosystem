# ADR: CP Comms Hub (messaging)

**Status:** Accepted (product v1 inbox)  
**Date:** 2026-11-05 (updated 2026-11-06)  
**Related:** [control-home-ia](./control-home-ia.md), [satellite-integration-channels.md](./satellite-integration-channels.md)

## Context

Owners need an org-scoped messaging surface under Control Home (`/workspace/comms-hub`). This must **not** be confused with CP-CHANNELS peer policy (FOLIO / SETTLEMENT / REVENUE / OPS_HANDOFF).

## Decision

1. **Separate product** from satellite integration channels — no channel graph rows, no money/folio gates.
2. **Actors:** org staff / owner (Control Home session JWT + org membership); not SuperAdmin channel editor.
3. **Product v1 inbox:**
   - Persist `CommsThread` / `CommsMessage` / `CommsParticipant` (org-scoped).
   - Nest APIs under `/v1/comms/*` (list/get/create/reply/mark-read + recipients).
   - Recipients = active `OrganizationMembership` users of the JWT org.
   - Delivery: in-app via `NotificationChannel.IN_APP` outbox (bell lists IN_APP for the JWT user only) + EMAIL outbox when recipient has email and `platform_notifications` entitlement allows (best-effort; inbox persists regardless).
4. **Scope:** threads never cross-tenant; empty recipients → 400; non-member recipients / non-participant reads → 403.

## Consequences

- Sprint `S-COMMS-HUB` tracks product depth.
- COVERAGE `CP-COMMS-01` → **API + SCREEN** (not STUB). **Not SHIPPED** without human UAT evidence.
- Channel harden (CP-CHANNELS) does not block or host messaging UI.
- Edition / Pilot / `ga` unchanged by this wave.

## Non-goals (this ADR)

- SMS / WhatsApp as required Comms v1 delivery
- Satellite peer FOLIO/REVENUE controls
- Bank / Data Hub chat
