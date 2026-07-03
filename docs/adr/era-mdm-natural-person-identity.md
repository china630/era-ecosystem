# ADR: ERA MDM natural-person identity

**Status:** Accepted  
**Date:** 2026-06-15

Promotes and expands [era-orchestrator/doc/adr/era-mdm-phase1.md](../../era-orchestrator/doc/adr/era-mdm-phase1.md).

## Decision

### Source of truth

`era-orchestrator` MDM DB (`GlobalNaturalPerson`, `PersonIdentifier`).

API: `POST /internal/v1/mdm/persons/lookup-by-fin`, `/resolve`, `/merge`.

### Satellite rules

- Store **`globalPersonId`** as the satellite identity link; **identifier values (FIN, passport) live in MDM**, not duplicated as plaintext on satellite models.
- **Exception — hotel ops cache:** `Guest` may retain non-identifier operational fields (name, phone, visa, CRM) per [hotel-guest-pii-ops-cache.md](./hotel-guest-pii-ops-cache.md); plaintext FIN/passport on `Guest` is **deprecated** (removed Wave 4).
- **lookup** = prefill/read; **resolve** = create/update person; **merge** = foreigner → citizen.
- Unified client: `linkPersonIdentity` in `@era/satellite-kit`.

### Enforcement tiers

| Tier | Examples | Rule |
|------|----------|------|
| Strict | PatientRef, Practitioner, Bank CIF natural | Block save without `globalPersonId` when identifier provided |
| Strong + ops cache | Guest | Resolve mandatory; no plaintext FIN/passport on `Guest` after W4 — see hotel ADR |
| Strong | Employee (Finance) | Cipher + blind index + `globalPersonId`; Finance SoR |
| Event-driven | FNB `StaffRoster`, clinic `Practitioner` (when Finance HR active) | `globalPersonId` from `STAFF_PROVISIONED` only; SatAdmin hire blocked when `finance_hr` policy |
| Read-only link | Counterparty ИП | VÖEN primary; FIN links natural person |

### ИП (individual entrepreneur)

- Business: `CounterpartyLegalForm.INDIVIDUAL` + VÖEN in Finance.
- Person: same `GlobalNaturalPerson` via FIN (`globalPersonId` on Counterparty).

## Related

- [hotel-guest-pii-ops-cache.md](./hotel-guest-pii-ops-cache.md)
- [mdm-legal-entity-vs-finance-counterparty-registry.md](./mdm-legal-entity-vs-finance-counterparty-registry.md)
- [mdm-satellite-integration-contract.md](./mdm-satellite-integration-contract.md)
- [workforce-identity-and-hr-provisioning.md](./workforce-identity-and-hr-provisioning.md)
