# ADR: Control Home information architecture

**Status:** Accepted  
**Date:** 2026-11-03  
**Product:** Orchestrator control plane (`era-orchestrator` apps/web + apps/platform-web)  
**Related:** [orchestrator-workspace-launcher.md](./orchestrator-workspace-launcher.md) · [commercial-topology-and-suspend.md](./commercial-topology-and-suspend.md) · [platform-console-cutover.md](./platform-console-cutover.md) · [satellite-integration-channels.md](./satellite-integration-channels.md) (peer policy graph — **not** this messaging stub)

## Context

`/workspace` must remain the SSO launcher for industry satellites. Owners also need Workforce, billing, org profile, and (later) Comms Hub without mixing commercial topology (org / department / satellite / outlet) into the Open tiles. Multi-org users need a durable **home** organization distinct from the session active org.

## Decision

1. **Control Home** is `/workspace` (and the shared authenticated shell around it) with four zones:
   - **Context bar** — active organization name, `ORG` / `DEPT` badge, org switcher, star to set **home**.
   - **Platform apps** — in-orchestrator surfaces: Workforce, Billing/subscription, Org profile; **Comms Hub** later in the same slot.
   - **Systems** — satellite tiles (Finance + industry): Open / Modules / Settings (SSO). Unchanged launch semantics from [orchestrator-workspace-launcher.md](./orchestrator-workspace-launcher.md).
   - **Structure** — separate page/drawer for Org → Department → Satellite → Outlet + kill switches. Not a substitute for Systems tiles.

2. **homeOrganizationId** — `OrganizationMembership.isHome` (at most one home per user). Login and `/` redirect resolve to home when session active org is unset. Switching org updates **active** session only; home changes only via explicit star.

3. **activeOrganizationId** lives in the auth/session JWT (existing pattern). Workforce, Billing UI, Structure, and future Comms Hub all read the same active org.

4. **platform-web** mirrors topology/ops Structure for SuperAdmin; client `apps/web` is owner Control Home. After cutover, vendor SA UI is platform-only ([platform-console-cutover.md](./platform-console-cutover.md)).

## Consequences

- Do not put outlet/department accordions on the Systems Open tiles.
- Department context = switch active org to the child `Organization` row (`operatingMode=DEPARTMENT`).
- Comms Hub must not invent a second org tree.
