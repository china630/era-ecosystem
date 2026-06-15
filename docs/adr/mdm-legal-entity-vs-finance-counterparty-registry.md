# ADR: MDM legal entity vs Finance counterparty registry

**Status:** Accepted  
**Date:** 2026-06-15

## Context

Two registries serve legal entities:

| Registry | DB | Key | Used for |
|----------|-----|-----|----------|
| `GlobalLegalEntity` | era_mdm | VÖEN | Org register, platform onboarding |
| `GlobalCounterparty` | era_finance | VÖEN | Invoices, purchases per org |

Natural persons (FIN) link via `GlobalNaturalPerson` — separate from VÖEN.

## Decision

- **ИП (F/Ş):** Finance `Counterparty` with `legalForm=INDIVIDUAL` + VÖEN; optional `globalPersonId` when FIN provided.
- **No automatic bridge** GlobalLegalEntity ↔ GlobalCounterparty in Wave 2 (Phase 2 TBD).
- Satellites never store VÖEN person PII — use Finance counterparty or MDM lookup.

## Related

- [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md)
