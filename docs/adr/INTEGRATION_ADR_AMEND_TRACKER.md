# Integration ADR amend tracker (W1–W4 doc alignment)

Checklist for **documentation vs wave plans**. Code implementation tracked in wave plan exit criteria.

**Last doc pass:** 2026-06-16 (R1 full re-audit — domains A–E COMPLIANT)

## CRM party model + import (v3.0 — SHIPPED 2026-07-02)

| Artifact | Doc status | Code |
|----------|------------|------|
| [crm-lead-party-model-and-prospect-import.md](./crm-lead-party-model-and-prospect-import.md) | **Accepted — SHIPPED v3.0** | **SHIPPED** 2026-07-02 |
| [era-crm PRD §9](../../era-crm/PRD.md#9-roadmap--v30-party-model-partners-import) | Amended 2026-07-02 | — |
| [era-crm TZ § Planned v3.0](../../era-crm/TZ.md) | Amended 2026-07-02 | — |
| [era-crm DELIVERY § Planned v3.0](../../era-crm/doc/DELIVERY-CRM.md) | `[x]` checkboxes | **SHIPPED** |
| `@era/contracts` `satelliteCrmLeadConvertedSchema` | Amended | **SHIPPED** |
| Finance `handleCrmLead` find-or-create CP | Amended | **SHIPPED** |
| [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md) CRM note | Amended 2026-07-02 | — |
| [DATA_MODEL_INTEGRATION_AUDIT.md](../DATA_MODEL_INTEGRATION_AUDIT.md) § era-crm | Amended | **SHIPPED** |
| [COVERAGE_MATRIX.md](../COVERAGE_MATRIX.md) CRM-PARTY-*, CRM-IMPORT-* | SHIPPED | — |
| `@era/contracts` `satelliteCrmLeadConvertedSchema` | Amended | **SHIPPED** |
| Finance `handleCrmLead` find-or-create CP | Amended | **SHIPPED** |
| ADR §8 Bitrix backlog M17–M30 | Amended 2026-07-02 | — |

## R1 re-audit (2026-06-16)

| Domain | ADRs verified | Code status |
|--------|---------------|-------------|
| A MDM natural person | hotel-guest-pii-ops-cache, era-mdm-natural-person-identity | **COMPLIANT** (W1/W4) |
| B Legal entity | mdm-legal-entity-vs-finance-counterparty-registry | **COMPLIANT** |
| C Reference / gateway | orchestrator-platform-integration-gateway, reference-data-ecosystem | **COMPLIANT** (W2) |
| D Workforce | workforce-identity-and-hr-provisioning | **COMPLIANT** (W3) |

Delta: [audit-snapshots/r1-delta-2026-06-16.md](../audit-snapshots/r1-delta-2026-06-16.md)

## Workforce (Wave 3)

| Artifact | Doc status | Code (Wave 3) |
|----------|------------|---------------|
| [workforce-identity-and-hr-provisioning.md](./workforce-identity-and-hr-provisioning.md) clinic path | Amended | **SHIPPED** |
| `GET /platform/v1/workforce/policy` | Amended INTEGRATION_SSO_EVENTS | **SHIPPED** |
| era-clinic workforce guard + provision | — | **SHIPPED** |

## Reference data (Wave 2)

| Artifact | Doc status | Code (Wave 2) |
|----------|------------|----------------|
| [orchestrator-platform-integration-gateway.md](./orchestrator-platform-integration-gateway.md) | **Accepted** | **SHIPPED** (CatalogGatewayModule) |
| [reference-data-ecosystem.md](./reference-data-ecosystem.md) § industry rule | Amended | — |
| [production-calendar-ecosystem.md](./production-calendar-ecosystem.md) | Amended | — |
| [fx-rates-ecosystem.md](./fx-rates-ecosystem.md) | Amended | — |
| [DATA_MODEL_INTEGRATION_AUDIT.md](../DATA_MODEL_INTEGRATION_AUDIT.md) §2, §8 | Amended | — |
| [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md) § Reference data | Amended | — |
| [REFERENCE_DATA_CONSUMER_AUDIT.md](../REFERENCE_DATA_CONSUMER_AUDIT.md) | Amended (W2 industry column) | SHIPPED |
| [SATELLITE_DOCUMENTATION.md](../SATELLITE_DOCUMENTATION.md) | Amended | — |

## MDM / hotel guest (Wave 1 ADR + Wave 4 schema)

| Artifact | Doc status | Code |
|----------|------------|------|
| [hotel-guest-pii-ops-cache.md](./hotel-guest-pii-ops-cache.md) | **Accepted** (W1-04 + W4-00 single lifecycle) | W4 DROP columns |
| [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md) Guest tier | Amended → Strong + ops cache | W4 |
| [workforce-identity-and-hr-provisioning.md](./workforce-identity-and-hr-provisioning.md) Guest line | Amended → hotel ADR link | — |

## Workforce (Wave 3)

| Artifact | Doc status | Code (Wave 3) |
|----------|------------|---------------|
| [workforce-identity-and-hr-provisioning.md](./workforce-identity-and-hr-provisioning.md) clinic path | Amended (finance_hr vs local_master) | W3-04 POST guard |
| [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md) event-driven tier | Amended (clinic Practitioner) | W3-08 verify at execution |

## Known pre-implementation drift (baseline audit)

Post–Wave 2: `audit-data-model-integration.mjs` — industry **no** `DATA_HUB_DIRECT` / `FINANCE_CATALOG_HANDOFF`; hotel `PII_DUPLICATE` **closed W4** (see [DATA_MODEL_INTEGRATION_AUDIT.md](../DATA_MODEL_INTEGRATION_AUDIT.md) X-03).

**Wave 5 (2026-06-16):** unified `run-integration-audits.mjs --strict` in CI — [INTEGRATION_AUDIT_CI.md](../INTEGRATION_AUDIT_CI.md).
