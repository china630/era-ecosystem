# ADR — Bank multi-entity holding (optional)

**Status:** Accepted (lab scaffold XO-6)  
**Date:** 2026-08-06  
**Related:** [era-bank-core.md](./era-bank-core.md) D5 (one deployment = one bank)

## Context

Full commercial CBS roadmap XO-6 introduces optional multi-bankOrg / agency banking within one install. ADR D5 default remains: **one deployment = one licensed bank (one VÖEN, one consolidated balance)**.

## Decision

1. **Default unchanged:** single `bankOrgId` per deployment; branches are a dimension, not separate orgs.
2. **Optional flag:** `BANK_MULTI_ENTITY=1` enables `AgencyLink` API to register peer bank org relationships for shared-services / agency scenarios.
3. **When flag off:** agency link POST returns lab-only metadata; no cross-org ledger routing.
4. **Pilot / GA:** multi-entity remains **DECLARED** until field policy + D5 companion doc updated with CBAR consent.

## Consequences

- No automatic data migration between bank orgs.
- Orchestrator entitlements still gate modules per org; multi-entity does not bypass tenancy.
- Inventory: `CAP-CORE-MENT`, `CAP-CORE-AGENCY` → IN (lab) with ADR note when scaffold ships; not sell-ready without flag + ops UAT.

## References

- Engine API: `GET/POST /api/v1/multi-entity/*`
- Inventory: [Bank-Capability-Inventory.md](../acceptance/Bank-Capability-Inventory.md)
