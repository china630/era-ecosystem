# ADR: Clinic patient clinical demographics (ops cache)

**Status:** Accepted — implemented 2026-07-14  
**Date:** 2026-07-14  

Amends the clinic side of [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md). Complements [hotel-guest-pii-ops-cache.md](./hotel-guest-pii-ops-cache.md).

## Context

Patient card identity showed MDM link, phone, and identifier *types*, but not sex or age. Care staff (nurse, doctor, reception) need sex and age at a glance for protocols, dosing context, and sanatorium rooming.

Clinic keeps a minimal ops display cache: `fullName`, `phone`, `nationality`, `sex`, `birthDate` on `PatientRef`, while **identifiers** (FIN/passport) stay MDM-only after Wave 1. **Legal sex and birthDate SoR is MDM** person core (`MALE`/`FEMALE`/`UNKNOWN`).

## Decision

Add a **clinical demographics ops cache** on `PatientRef`:

| Field | Notes |
|-------|--------|
| `sex` (`PatientSex`) | MALE / FEMALE / OTHER / UNKNOWN |
| `birthDate` (date) | Source of truth for age; UI derives `ageYears` |
| `bloodGroup` | ABO± for care / emergency; optional UNKNOWN |
| `emergencyContactName` / `emergencyContactPhone` | Sanatorium emergency reachability |
| `nationality` | Already present — surface on card |

**Not stored locally as SoR:** FIN, passport, issuing country (remain MDM / transient intake). **Sex and birthDate** are MDM person-core SoR (`MALE`/`FEMALE`/`UNKNOWN` — no OTHER); `PatientRef` columns remain an ops cache filled from resolve/ops-profile.

**Not in this wave:** height/weight, pregnancy status, preferred language, allergy free-text (structured contraindications + procedures already cover care alerts).

Clinic prefers resolve-from-MDM and treats local columns as cache (same path as hotel guest ops-profile).

## Consequences

- Card header shows `refCode · sex · age`.
- Register + edit capture demographics without changing MDM identity contract.
- Slight intentional denormalization of non-identifier clinical PII — documented exception parallel to hotel Guest `gender` / `birthDate`.

## Related

- CLI-28 in `docs/COVERAGE_MATRIX.md`
- `era-clinic` migration `20260714160000_patient_clinical_demographics`
