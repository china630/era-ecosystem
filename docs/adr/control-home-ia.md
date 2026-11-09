# ADR: Control Home information architecture

**Status:** Accepted  
**Date:** 2026-11-03  
**Product:** Orchestrator control plane (`era-orchestrator` apps/web + apps/platform-web)  
**Related:** [orchestrator-workspace-launcher.md](./orchestrator-workspace-launcher.md) · [commercial-topology-and-suspend.md](./commercial-topology-and-suspend.md) · [platform-console-cutover.md](./platform-console-cutover.md) · [satellite-integration-channels.md](./satellite-integration-channels.md) (peer policy — **not** messaging) · [cp-comms-hub-messaging.md](./cp-comms-hub-messaging.md)

## Context

`/workspace` must remain the SSO launcher for industry satellites. Owners also need Workforce, billing, org profile, and Comms Hub without mixing commercial topology (org / department / satellite / outlet) into the Open tiles. Multi-org users need a durable **home** organization distinct from the session active org.

## Decision

1. **Control Home** is `/workspace` (and the shared authenticated shell around it) with four zones:
   - **Context bar** — active organization name, `ORG` / `DEPT` badge, org switcher, star to set **home**.
   - **Platform apps** — in-orchestrator surfaces: Workforce, Billing/subscription, Org profile; **Comms Hub** list+compose shell in the same slot (see [cp-comms-hub-messaging.md](./cp-comms-hub-messaging.md); not channel FOLIO/REVENUE); **document register** at `/workspace/documents` (see [cp-document-register.md](./cp-document-register.md)).
   - **Systems** — satellite tiles (Finance + industry): Open / Modules / Settings (SSO). Unchanged launch semantics from [orchestrator-workspace-launcher.md](./orchestrator-workspace-launcher.md).
   - **Structure** — separate page for Org → Department → Satellite → Outlet + kill switches (owner hierarchical UX on `/workspace/structure`; Home shows compact structure counts + Manage structure). Not a substitute for Systems tiles. CP outlet create registers billing/allowlist only; ops outlet materialize remains sat→CP upsert.

2. **homeOrganizationId** — `OrganizationMembership.isHome` (at most one home per user). Login and `/` redirect resolve to home when session active org is unset. Switching org updates **active** session only; home changes only via explicit star.

3. **activeOrganizationId** lives in the auth/session JWT (existing pattern). Workforce, Billing UI, Structure, and Comms Hub all read the same active org.

4. **platform-web** mirrors topology/ops Structure for SuperAdmin; client `apps/web` is owner Control Home. After cutover, vendor SA UI is platform-only ([platform-console-cutover.md](./platform-console-cutover.md)).

## Consequences

- Do not put outlet/department accordions on the Systems Open tiles (summary counts + link to Structure only).
- Department context = switch active org to the child `Organization` row (`operatingMode=DEPARTMENT`); Structure tree switch uses the same `/auth/switch-organization` as the header switcher.
- After org switch, Structure fetches must use the refreshed access token from storage (not a stale React closure).
- Comms Hub must not invent a second org tree.
- The owner tree lives on app `/workspace/structure`. Platform console does not host a second structure screen.
