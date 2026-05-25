# ADR: ERA MDM Phase 1 (option B)

## Status

Accepted — Wave 3 (HN-P)

## Context

Satellites (hotel, clinic, finance) must reference people and organizations without duplicating PII. Citizen consent portal is deferred; foundation must support `globalPersonId` on satellite records.

## Decision

1. **Separate database** `era_mdm` (`MDM_DATABASE_URL`), distinct from control-plane PostgreSQL.
2. **API owner:** `era-365-orchestrator` — `internal/v1/mdm/*`.
3. **Models:** `GlobalNaturalPerson`, `GlobalLegalEntity`, stubs `PersonAccessRequest`, `PersonAccessGrant`, `PersonAccessLog`.
4. **Crypto:** server AES-256-GCM + HMAC blind index (same pattern as Finance `pii-crypto.util.ts`).
5. **Registration cutover:** new org registration should call orchestrator `POST /internal/v1/mdm/organizations/register` (creates control-plane `Organization` + MDM legal entity). Finance `auth.service.createOrganizationForExistingUser` remains until proxy/cutover sprint.

## Satellite contract

- Store **`globalPersonId`** (UUID) only — no duplicate passport/FIN in satellite DBs when MDM linked.
- Clinic `PatientRef.globalPersonId`, hotel guest linkage via future MDM lookup — Wave 3 uses local `patientRef` / guest record with optional `globalPersonId`.

## Smoke

```bash
curl -s http://localhost:4100/internal/v1/mdm/health
curl -s -X POST http://localhost:4100/internal/v1/mdm/organizations/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Nafta Demo LLC","taxId":"9900000001","ownerUserId":null}'
```
