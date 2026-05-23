# ERA Auto STO — PRD

## §1 Vision

Work orders, labor, parts. Operational satellite; GL and counterparty master data live in **era-finance-core**.

## §3 Modules

| Module | Status |
|--------|--------|
| MVP shell | IN_PROGRESS |
| Orchestrator events | PLANNED |
| SSO exchange | PLANNED |

## §5 Integrations

- Outbound: `POST /api/v1/satellite-events` via orchestrator
- Finance: invoice/stock via event worker (no direct GL in satellite)

## §7 Changelog

| Date | Note |
|------|------|
| 2026-05-23 | Initial scaffold |
