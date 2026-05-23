# ERA Retail POS — PRD

## §1 Vision

POS with grocery, apparel, electronics, pharmacy presets. Operational satellite; GL and counterparty master data live in **era-finance-core**.

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
