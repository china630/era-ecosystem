# ADR: Nafta one stay, two episodes (Wave E)

**Status:** Accepted — 2026-08-30

## Decision

1. OPEN clinical episode uniqueness: partial unique index on `(organizationId, reservationId, patientRefId)` where `status = OPEN` — not reservation-only.
2. `PatientRef` for in-house: `MDM-{globalPersonId}` when linked; else `HOTEL-{reservationId8}-{paxKey}` (`ReservationGuest.id`). Never one `HOTEL-{reservationId}` for the whole party.
3. Hotel check-in emits **one** `SATELLITE_HOTEL_GUEST_CHECKED_IN` per pax with that guest’s `medicalPackageCode`, `globalPersonId`, `guestName`, and `paxKey`.
4. Quota/charge resolve `ProgramInstance` via `episode.patientRefId` (OPEN), never `findFirst({ reservationId })` alone.
5. Checkout / room-change fan-out to **all** OPEN episodes for the reservation. Stay date amend recalcs **each** instance with that episode’s `programCode`.
6. Share rooms (`707` / `707S`) remain **two reservations** → two episodes — out of scope for merge.
7. Same-SKU couple still gets **two** charts (two patients, same program code).
8. Folio stays **one** reservation / Wave D composed nightly sell.

## Related

CLI-54 SCREEN, HOT-PKG-04 API; folio compose = Wave D. Amends dual-run ADR pax column usage.
