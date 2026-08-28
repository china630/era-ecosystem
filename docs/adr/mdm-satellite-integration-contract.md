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

const { globalPersonId } = await linkPersonIdentity({
  fin, passport, issuingCountry, fullName, phone, nationality,
  sex, birthDate, globalPersonId: existingId,
}, { requesterOrgId, purpose: "intake" });
```

## Anti-patterns

- Lookup-only on create routes
- Duplicate FIN/passport plaintext in satellite DB when MDM-linked
- Direct citizen PII in industry satellites bypassing MDM

## Related

- [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md)
- [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md)
