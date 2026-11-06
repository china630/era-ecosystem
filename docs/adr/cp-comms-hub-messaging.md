# ADR: CP Comms Hub (messaging)

**Status:** Accepted (shell)  
**Date:** 2026-11-05  
**Related:** [control-home-ia](./control-home-ia.md), [satellite-integration-channels.md](./satellite-integration-channels.md)

## Context

Owners need an org-scoped messaging surface under Control Home (`/workspace/comms-hub`). This must **not** be confused with CP-CHANNELS peer policy (FOLIO / SETTLEMENT / REVENUE / OPS_HANDOFF).

## Decision

1. **Separate product** from satellite integration channels — no channel graph rows, no money/folio gates.
2. **Actors:** org staff / owner (Control Home session); not SuperAdmin channel editor.
3. **v0 shell:** local client list + compose draft only (no server persistence / no notifications yet).
4. **Scope:** threads are org-scoped (`user.organizationId`); never cross-tenant.

## Consequences

- Sprint `S-COMMS-HUB` tracks product depth; COVERAGE `CP-COMMS-01` stays STUB until inbox API + UAT.
- Channel harden (CP-CHANNELS) does not block or host messaging UI.

## Non-goals (this ADR)

- Email/SMS outbox (platform notifications pack)
- Satellite peer FOLIO/REVENUE controls
- Bank / Data Hub chat
