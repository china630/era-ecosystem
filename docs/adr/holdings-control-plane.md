# ADR: Holdings source of truth on the control plane

## Status

Accepted — 2026-07-12

## Context

Finance historically owned `Holding`, `HoldingMembership`, and `Organization.holdingId` for multi-entity grouping and consolidated reporting. After Finance slimming, organization portfolio CRUD lives on Orchestrator. Holding composition is an org-relationship concern and must not remain a Finance SoT.

`parentOrgId` + `OrgOperatingMode.DEPARTMENT` already model **money routing** (e.g. hotel department). Holdings are a **third** concept: arbitrary multi-VOEN grouping for consolidated P&L / cash / tax-risk dashboards.

## Decision

1. **Orchestrator** owns holdings schema and composition APIs (`v1/holdings/*`, `internal/v1/holdings/*`).
2. **Finance** is a live consumer: reporting resolves composition + `canViewReports` via S2S `GET /internal/v1/holdings/:id?userId=`, then aggregates Finance GL/bank/tax over returned `organizationIds`.
3. Local Finance tables `holdings`, `holding_memberships`, and `organizations.holding_id` are **removed** (point-zero; no data migration).
4. Holding report roles (`OWNER` / `ADMIN` / `ACCOUNTANT` / `VIEWER`) stay distinct from org `UserRole`. VIEWER may list a holding but cannot open consolidated reports.

## Consequences

- Finance web `/holding`, `/reporting/holding` keep working against Finance `/api/holdings*` which proxies/reads CP.
- Holding create / attach / members UI lives on Orchestrator `/holdings`.
- No CP→Finance push events for holdings; live pull is enough for reporting volume.
- Org IDs are shared across CP and Finance (same identity during control-plane migration).

## Related

- `docs/adr/org-operating-mode.md` (DEPARTMENT ≠ holding)
- `docs/CONTROL_PLANE_ARCHITECTURE.md`
- `docs/INTEGRATION_SSO_EVENTS.md` (`internal/v1/holdings`)
