# ADR: Organization document register (cycle 1)

**Status:** Accepted (implementing)
**Date:** 2026-11-09
**Products:** `era-orchestrator` (control plane workspace)
**Related:** [cp-workforce-job-architecture.md](./cp-workforce-job-architecture.md) · [cp-workforce-hr-routes.md](./cp-workforce-hr-routes.md) · [cp-comms-hub-messaging.md](./cp-comms-hub-messaging.md)

## Context

A document register (incoming, outgoing, internal) is an organization capability. It is not hotel, clinic, or finance operational data, and it is not the HR personnel-order flow. Routing must use the same org-structure step kinds as workforce approvals. Rank is never inferred from org-unit tree depth.

## Decision

1. **SoR.** Cards, files, physical locations, route templates, instances, tasks, and decisions live in the orchestrator database, scoped by `organizationId`.
2. **People and seats.** The author is an active `WorkforceEmployment`. A step kind is `WorkforceApprovalStepKind` and resolves through `WorkforceApprovalService`. An empty resolve is `APPROVAL_STEP_UNASSIGNED`. The wrong person gets `APPROVAL_STEP_FORBIDDEN`.
3. **Route shape in cycle 1.** A template is an ordered list. One open step at a time. Any assignee of that step may decide; sibling tasks on the step close together. Reject returns the card to the author and stops the route. There is no canvas and no BPMN.
4. **Channel.** Assignment and return open a Comms Hub thread when the assignee has a platform user other than the actor. Comms does not store the document. A comms failure does not roll back the route.
5. **Archive.** Location tree is site → room → rack → shelf → box → folder. A card can point at a folder. This is storage, not a route step.
6. **Cycle 2.** A step is `ANY` or `ALL`. `skipUnlessKind` and `minAmount` skip a step. An empty resolve leaves the route open (`awaitingAssignment`) until a clerk assigns an employment. Overdue open tasks get one Comms notice (`overdueNotifiedAt`).
7. **Cycle 3.** `DocRouteEdge` is the picture of the chain (`from` empty = start). Saving steps rewrites edges `1→2→3`. A hole is `DOC_ROUTE_GAP`. `layoutX` / `layoutY` are display only. Rejection stays a decision, not a back-arrow.

## Consequences

- Cycle 4: reply-to number, file text replace before the route starts, in-place template edit (blocked while an OPEN instance exists; layout still saved), ALL card lists open assignees, reject may reopen an earlier step without a back-edge. Coverage stays API/SCREEN.
- `AC-CP-DOC` is Scaffold **🟡** and out of the platform BE rollup.
- HR approval tables are not rewritten.
