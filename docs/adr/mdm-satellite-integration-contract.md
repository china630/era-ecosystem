# ADR: MDM satellite integration contract

**Status:** Accepted  
**Date:** 2026-06-15

## Env vars

| Variable | Consumer |
|----------|----------|
| `ORCHESTRATOR_URL` / `CONTROL_PLANE_URL` | Base URL |
| `MDM_INTERNAL_SERVICE_TOKEN` / `SATELLITE_EVENT_SERVICE_TOKEN` | Bearer for `/internal/v1/mdm/*` |
| `ERA_CLINIC_PRACTITIONER_MDM_STRICT` | Block practitioner save without MDM link |
| `ERA_HOTEL_GUEST_MDM_STRICT` | Block guest save without identifier |
| `MDM_REQUIRED` (bank-core) | Fail CIF create if MDM unreachable (no stub) |

## Client pattern

```typescript
import { linkPersonIdentity } from "@era/satellite-kit";

// Prefer name parts; fullName alone is still accepted (MDM splits + dual-writes).
const { globalPersonId } = await linkPersonIdentity({
  fin, passport, issuingCountry,
  firstName, middleName, lastName, // or fullName
  phone, nationality, // nationality = ISO citizenship (AZ, KZ)
  sex, birthDate, globalPersonId: existingId,
}, { requesterOrgId, purpose: "intake" });
```

**Resolve / ops-profile shape:** write and read `firstName` / `middleName` / `lastName` plus denormalized `fullName`. Empty incoming fields do not clear existing MDM values. Passport `issuingCountry` is the document country (not person nationality).

## Anti-patterns

- Lookup-only on create routes
- Duplicate FIN/passport plaintext in satellite DB when MDM-linked
- Direct citizen PII in industry satellites bypassing MDM
- Treating `nationality` as ethnicity or passport issuing country
- Clearing middleName / phone by sending empty strings on resolve

## Related

- [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md)
- [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md)
