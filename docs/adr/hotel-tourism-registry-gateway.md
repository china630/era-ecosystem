# ADR: Tourism registry compliance gateway (H-BL-23)

## Context

Hotel check-in creates `MigrationRegistration` rows with guest identity payload. Production submit to AZ tourism/KBS registry requires certified integration.

## Decision

- **Hotel** owns registration lifecycle UI and payload assembly (`tourism-registry.service.ts`).
- **Submit adapter** supports `TOURISM_REGISTRY_MOCK=true` (default) and live `TOURISM_REGISTRY_URL` + token.
- **MVP export:** `GET /api/migration/{id}/submit` export + manual portal upload.
- **Prod:** `POST /api/migration/{id}/submit` pushes to gateway; status `SUBMITTED|REJECTED` on row.

## Consequences

- PII stays MDM-linked; payload uses hotel guest fields only for ops.
- Finance/compliance review required before `TOURISM_REGISTRY_MOCK=false`.
