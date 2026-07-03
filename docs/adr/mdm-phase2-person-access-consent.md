# ADR: MDM Phase 2 — person access consent portal

**Status:** Phase 2 MVP (2026-06-16)  
**Date:** 2026-06-15

## Scope (future)

- `PersonAccessRequest` / citizen grants for cross-org FIN lookup
- Self-service consent portal — **MVP** at orchestrator `/portal/person-access` (guest QR session)
- Auto `PersonAccessRequest` on masked FIN lookup when grant missing
- Today: SuperAdmin MDM UI + service-token resolve for satellites

## Wave 4 delivered

- Ops merge UI: patient/guest/employee «Получен FIN» → `mergePersonRecords`
- Consent portal explicitly out of scope

## Related

- [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md)
