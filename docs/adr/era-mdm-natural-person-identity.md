# ADR: ERA MDM natural-person identity

**Status:** Accepted  
**Date:** 2026-06-15

Promotes and expands [era-orchestrator/doc/adr/era-mdm-phase1.md](../../era-orchestrator/doc/adr/era-mdm-phase1.md).

## Decision

### Source of truth

`era-orchestrator` MDM DB (`GlobalNaturalPerson`, `PersonIdentifier`).

API: `POST /internal/v1/mdm/persons/lookup-by-fin`, `/resolve`, `/merge`.

### Satellite rules

- Store **`globalPersonId` only** in satellite DBs; PII in MDM.
- **lookup** = prefill/read; **resolve** = create/update person; **merge** = foreigner → citizen.
- Unified client: `linkPersonIdentity` in `@era/satellite-kit`.

### Enforcement tiers

| Tier | Examples | Rule |
|------|----------|------|
| Strict | PatientRef, Practitioner, Bank CIF natural | Block save without `globalPersonId` |
| Strong | Guest, Employee | Require identifier; resolve mandatory |
| Event-driven | FNB StaffRoster | Provision from Finance HR only |
| Read-only link | Counterparty ИП | VÖEN primary; FIN links natural person |

### ИП (individual entrepreneur)

- Business: `CounterpartyLegalForm.INDIVIDUAL` + VÖEN in Finance.
- Person: same `GlobalNaturalPerson` via FIN (`globalPersonId` on Counterparty).

## Related

- [mdm-legal-entity-vs-finance-counterparty-registry.md](./mdm-legal-entity-vs-finance-counterparty-registry.md)
- [mdm-satellite-integration-contract.md](./mdm-satellite-integration-contract.md)
- [workforce-identity-and-hr-provisioning.md](./workforce-identity-and-hr-provisioning.md)
