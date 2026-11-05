# ADR: Operator Finance dogfood for platform invoices

**Status:** Accepted  
**Date:** 2026-11-03  
**Related:** [platform-billing-lines.md](./platform-billing-lines.md) · [CONTROL_PLANE_ARCHITECTURE.md](../CONTROL_PLANE_ARCHITECTURE.md) · [satellite-finance-bridge-pattern.md](./satellite-finance-bridge-pattern.md)

## Context

ERA sells subscriptions from the control plane but needs real AR, bank match, and GL in **Finance** for the operator company itself (dogfood), without moving entitlement SoT back into Finance.

## Decision

1. Config **`ERA_OPERATOR_ORGANIZATION_ID`** — STANDALONE org that owns the operator Finance tenant bind.

2. Commercial SoT stays orchestrator (catalog, grace, monthly run, structured lines).

3. On platform invoice finalize: idempotent `PLATFORM_INVOICE_ISSUED` (stable invoice id) -> operator Finance creates/updates **sales invoice** + counterparty from customer org profile (VOEN / ERA ID).

4. Payment matched in operator Finance -> `PLATFORM_INVOICE_PAID` -> CP marks invoice paid / clears block path as product rules allow.

5. Void/credit use paired events; do not dual-write entitlement tables from Finance.

6. SaaS revenue NAS/GL mapping is configured once on the operator chart.

## Consequences

- Customer orgs' own Finance tenants are unrelated AR (their guests/suppliers).
- Operator CRM dogfood (later) reads CP/Finance projections; it does not replace this bridge.
