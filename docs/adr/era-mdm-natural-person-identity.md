# ADR: ERA MDM natural-person identity

**Status:** Accepted  
**Date:** 2026-06-15  
**Updated:** 2026-09-01 — name parts SoR (first/middle/last)

Promotes and expands [era-orchestrator/doc/adr/era-mdm-phase1.md](../../era-orchestrator/doc/adr/era-mdm-phase1.md).

## Decision

### Source of truth

`era-orchestrator` MDM DB (`GlobalNaturalPerson`, `PersonIdentifier`).

API: `POST /internal/v1/mdm/persons/lookup-by-fin`, `/resolve`, `/merge`.

### Person name (SoR)

On `GlobalNaturalPerson`:

| Field | Meaning |
|-------|---------|
| `firstNameCipher` | Given name (ad) |
| `middleNameCipher` | Patronymic (ata adı) — optional |
| `lastNameCipher` | Surname (soyad) |
| `fullNameCipher` | **Denormalized** compose: `first + middle + last` (skip empty; space-separated) |

**Create:** require `firstName`+`lastName`, **or** legacy `fullName` (MDM splits: 1→first; 2→first+last; 3+→first+middle+last). Particles (`oglu`/`qizi`) stay in `middleName`.

**Update (fill-not-clear per field):** non-empty incoming writes that field; empty/omit does **not** clear existing. After merge, recompute `fullNameCipher` from parts. Do **not** use blob token-count merge as the write path.

**nationality:** ISO 3166-1 alpha-2 **citizenship** (`KZ`), not ethnicity. `OTHER` / garbage → do not write (do not overwrite a valid ISO). No ethnicity field on person.

**phone:** contact cipher only — **not** a resolve match key. Empty string does not clear.

**Identifiers:** `PersonIdentifier` (`AZ_FIN`, `PASSPORT`, …). Passport `issuingCountry` is document SoR — do not substitute person `nationality`. Missing passport country last-resort `"AZ"` (satellites should send blank country; debt for hotel/clinic/finance steps).

**Login `User.fullName`:** session stamp only — **out of person canon**.

**Ethnicity / Bank CIF / CRM lookup:** out of this ADR wave; tracked as debt.

### Satellite rules

- Store **`globalPersonId`** as the satellite identity link; **identifier values (FIN, passport) live in MDM**, not duplicated as plaintext on satellite models.
- **Person core demographics (SoR):** `sex` (`MALE` | `FEMALE` | `UNKNOWN`) and `birthDate` on `GlobalNaturalPerson`. Azerbaijan does not use a third legal sex — **no OTHER**. Satellites (hotel `Guest.sex`, clinic `PatientRef.sex` / `birthDate`) are **ops cache**; resolve/link writes the core; ops-profile is the read path.
- **Exception — hotel ops cache:** `Guest` may retain non-identifier operational fields (name, phone, visa, CRM, gender/DOB cache) per [hotel-guest-pii-ops-cache.md](./hotel-guest-pii-ops-cache.md); plaintext FIN/passport on `Guest` is **deprecated** (removed Wave 4).
- **lookup** = prefill/read; **resolve** = create/update person (name parts + sex/DOB fill-not-clear); **merge** = foreigner → citizen.
- Unified client: `linkPersonIdentity` in `@era/satellite-kit`. Accepts `firstName`/`middleName`/`lastName` and/or legacy `fullName`; pass `sex`/`gender` + `birthDate`. When the satellite already has `globalPersonId`, pass it so a card edit fills MDM without a second person.
- Read paths (lookup / ops-profile / admin list) return **parts + composed `fullName`** so old clients keep working.

### Rollout debt (steps after MDM)

1. ~~MDM schema + resolve dual-write~~ (step 1)
2. ~~Orchestrator workforce CSV/UI~~ (step 2): super-admin MDM directory + resolve modal (Ad / Ata adı / Soyad); workforce hire + employee card; roster import/export (`firstName,middleName,lastName` + legacy `fullName`); Nafta `mapRosterRow` AZ surname-first `Tam adı` → parts; `STAFF_PROVISIONED.fullName` composed from MDM parts. Login `User.fullName` unchanged.
3. ~~Hotel GuestCard / `sex` rename~~ (step 3): `Guest.sex` + name parts to MDM; ISO nationality; `parentFatherName` ≠ patronymic; GuestCard three fields + EW import unchanged columns
4. ~~Clinic PatientRef / Practitioner~~ (step 4): `firstName`/`middleName`/`lastName` Prisma maps; PatientSex no OTHER; MDM parts; phone not identifier; WO import EW-split Name
5. ~~Finance drop `patronymic` / kill `splitAzPersonName`~~ (step 5): `Employee.birthDate` Prisma map; no `patronymic` column; `personDisplayFromOpsProfile` reads MDM parts; hire/edit/opening-balance resolve `middleName` to MDM; ƏMAS prefill from parts; AZ list formatter `formatAzEmployeeListName` only
6. ~~Bank / CRM lookup alignment~~ (gap close): person-lookup BFF accepts name parts; Finance counterparty ИП resolve sends parts; nationality ISO without OTHER collapse on hotel/clinic lookup

**Ops after migrate:** `npx tsx packages/mdm-database/prisma/scripts/backfill-person-name-parts.ts` (needs `PII_ENCRYPTION_KEY` + `MDM_DATABASE_URL`). Optional `DRY_RUN=1`.

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
