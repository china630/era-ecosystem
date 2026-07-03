# ADR: Hotel guest PII — MDM identity + operational cache

**Status:** Accepted — **implemented W4** (schema slim-down complete)  
**Date:** 2026-06-16  
**Lifecycle:** Draft decision **W1-04** → finalize **W4-00** (single ADR, not a second document)

Amends [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md) § Guest enforcement tier.

## Context

Hotel `Guest` carries a large operational profile (CRM, visa, loyalty, tourism compliance) plus plaintext `nationalIdFin` / `passportNumber` alongside `globalPersonId`. Clinic `PatientRef` / `Practitioner` target **MDM-only identity storage** (Wave 1). Hotel reception needs local search, CRM, and fast guest-card UX under load — full transient-only UI like greenfield bank CIF is not required.

## Decision

### Two-layer model (hotel-specific)

| Layer | System of record | Stored on `Guest` (satellite DB) |
|-------|------------------|----------------------------------|
| **Identity** | MDM `GlobalNaturalPerson` + `PersonIdentifier` | **`globalPersonId` only** (no plaintext FIN/passport on `Guest` after W4) |
| **Operational cache** | Satellite (denormalized for ops) | `fullName`, name parts, `phone`, `email`, `nationality`, `birthDate`, visa fields, consent flags, loyalty, CRM extensions |
| **Travel documents (non-primary)** | Satellite `GuestDocument` | Scanned copies, secondary permits — **not** primary identity SoR |

Intake FIN/passport is **transient** → `linkPersonIdentity` → persist `globalPersonId` only.

Display/edit uses MDM **ops-profile** (masked identifiers) via orchestrator internal API — Wave 4.

### Enforcement tier (replaces «Strong = local passport OK»)

| Tier | Guest rule |
|------|------------|
| **Strong + ops cache** | Identifier required at intake; `linkPersonIdentity` mandatory; **no** plaintext FIN/passport columns on `Guest` |
| **Strict mode** | `ERA_HOTEL_GUEST_MDM_STRICT=true` (default in production templates post-W4) blocks save without MDM link |

This is **not** the same tier as clinic **Strict** (no local ops name cache required on PatientRef identity path). Hotel retains ops cache by design.

### GuestDocument

- `GuestDocument.docNumber` may duplicate numbers from scans — operational registry, not dedup primary key.
- Primary FIN/passport SoR remains MDM.
- Encryption at rest for `docNumber` — deferred (optional W4.1).

### Sync on MDM merge

On `person-merge`, update `Guest.globalPersonId` only; refresh display names from resolve/ops-profile as needed. Do not write merged FIN to local identity columns (removed post-W4).

### Import (ElectraWeb / Nafta)

Guest import resolves identity via MDM; sets `globalPersonId`; **does not** persist FIN/passport on `Guest` row (Wave 4).

### Compliance exports

Tourism registry and migration prefill **resolve** passport/FIN from MDM at export time (`resolveIdentifierForCompliance`). Short-lived payload in `tourismSubmission.payloadJson` is an ops artifact, not SoR.

## Implementation status

| Item | Wave | Status |
|------|------|--------|
| ADR policy (this doc) | W1-04 / W4-00 | **Accepted** |
| DROP `nationalIdFin`, `passportNumber` on Guest | W4-02 | **Done** |
| ops-profile API + guest card UI | W4-01, W4-05 | Planned |
| Import resolve-only | W4-06 | Planned |

Until Wave 4, plaintext columns are **known schema drift** — [DATA_MODEL_INTEGRATION_AUDIT.md](../DATA_MODEL_INTEGRATION_AUDIT.md) finding X-03.

**Update 2026-06-16:** W4 shipped — columns dropped; audit X-03 closed.

## Consequences

- Audit `PII_DUPLICATE` for hotel clears after W4 migration.
- Reception still searches by phone/name locally; identifiers from MDM when needed.
- Differs from clinic PatientRef (minimal local ops fields) — documented exception, not ad-hoc drift.

## Related

- [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md)
- [mdm-satellite-integration-contract.md](./mdm-satellite-integration-contract.md)
- [hotel-master-data-retire-policy.md](./hotel-master-data-retire-policy.md)
- Wave plans: `.cursor/plans/w1_mdm_pii_clinic_bde76248.plan.md`, `.cursor/plans/w4_hotel_guest_pii_5f727947.plan.md`
