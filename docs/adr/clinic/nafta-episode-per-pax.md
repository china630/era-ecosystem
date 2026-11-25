# ADR: Nafta one stay, two episodes (Wave E)

**Status:** Accepted — 2026-08-30

## Decision

1. OPEN clinical episode uniqueness: partial unique index on `(organizationId, reservationId, patientRefId)` where `status = OPEN` — not reservation-only.
2. `PatientRef` for in-house: `MDM-{globalPersonId}` when linked; else `HOTEL-{reservationId8}-{paxKey}` (`ReservationGuest.id`). Never one `HOTEL-{reservationId}` for the whole party.
3. Hotel check-in emits **one** `SATELLITE_HOTEL_GUEST_CHECKED_IN` per pax with that guest’s `medicalPackageCode`, `globalPersonId`, `guestName`, and `paxKey`. The same per-pax shape is used earlier: `SANATORIUM_BOOKING_CREATED` on create / pre-arrival save, and `STAY_PRODUCT_CHANGED` only once the stay is `IN_HOUSE`.
4. Quota/charge resolve `ProgramInstance` via `episode.patientRefId` (OPEN), never `findFirst({ reservationId })` alone.
5. **Stay-level** checkout / room-change fan-out to **all** OPEN episodes for the reservation. Stay date amend recalcs **each** instance with that episode’s `programCode`. **Person-level Depart guest** (companion leaves, stay stays `IN_HOUSE`) must fan-out to **that pax only** — [hotel-reservation-card-and-party-ops.md](./hotel-reservation-card-and-party-ops.md) D4/D6. Until that verb ships, do not emit stay `GUEST_CHECKED_OUT` for a companion departure.
6. Share rooms (`707` / `707S`) remain **two reservations** → two episodes — out of scope for merge.
7. Same-SKU couple still gets **two** charts (two patients, same program code).
8. Folio stays **one** reservation / Wave D composed nightly sell.
9. A shared surname is not the same person. Clinic may reuse an OPEN episode only when it is still unbound (`hotelStayId` empty or equal to the reservation id) **and** the full name matches. An episode already keyed `::pax:` or `::mdm:` is that guest’s chart. Hotel check-in, Elektra check-in, Depart guest, and Move guest send `globalPersonId` from that party row only. The primary guest’s MDM id is used only when the row is the primary guest. Depart and Move select that chart by the same stay id (`reservationId::pax:` or `reservationId::mdm:`). Move writes the destination stay id in that shape, not the bare reservation id. A clinic-native `P-` code is not the lookup key.

## Related

CLI-54 SCREEN, HOT-PKG-04 API; folio compose = Wave D. Amends dual-run ADR pax column usage. Person-level depart vs stay checkout: [hotel-reservation-card-and-party-ops.md](./hotel-reservation-card-and-party-ops.md).
